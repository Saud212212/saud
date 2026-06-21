"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { actionError, type ActionResult } from "@/lib/actions";
import { assertClinicCanWrite } from "@/lib/subscription";
import {
  canWriteMedicalRecord,
  canWritePrescription,
  canManageAppointments,
  canUploadFiles,
} from "@/types/rbac";
import {
  medicalRecordSchema,
  prescriptionSchema,
  appointmentSchema,
  MAX_FILE_SIZE,
  ALLOWED_MIME,
  ALLOWED_FILE_TYPES,
} from "@/lib/validation/medical";
import type { Json } from "@/types/database.types";

function z_flatten(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** حفظ/تحديث السجل الطبي للمريض (upsert على patient_id). */
export async function upsertMedicalRecord(
  patientId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح.");
  if (!canWriteMedicalRecord(user.role) || !user.clinicId) {
    return actionError("ليست لديك صلاحية تعديل السجل الطبي.");
  }
  const gate = await assertClinicCanWrite(user);
  if (!gate.ok) return actionError(gate.error);

  const parsed = medicalRecordSchema.safeParse({
    chronic_diseases: formData.get("chronic_diseases"),
    allergies: formData.get("allergies"),
    past_surgeries: formData.get("past_surgeries"),
    current_medications: formData.get("current_medications"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return actionError("تحقق من الحقول.", z_flatten(parsed.error));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("medical_records").upsert(
      {
        patient_id: patientId,
        clinic_id: user.clinicId,
        ...parsed.data,
        updated_by: user.id,
      },
      { onConflict: "patient_id" },
    );
    if (error) return actionError(error.message);

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: "update",
      entityType: "medical_record",
      entityId: patientId,
    });
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع.");
  }
}

/** إنشاء وصفة طبية (الأطباء فقط). */
export async function createPrescription(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح.");
  if (!canWritePrescription(user.role) || !user.clinicId) {
    return actionError("الوصفات الطبية يكتبها الأطباء فقط.");
  }
  const gate = await assertClinicCanWrite(user);
  if (!gate.ok) return actionError(gate.error);

  let medications: unknown = [];
  try {
    medications = JSON.parse(String(formData.get("medications") ?? "[]"));
  } catch {
    return actionError("بيانات الأدوية غير صالحة.");
  }

  const parsed = prescriptionSchema.safeParse({
    patient_id: formData.get("patient_id"),
    medications,
    dosage: formData.get("dosage"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return actionError("تحقق من بيانات الوصفة.", z_flatten(parsed.error));
  }

  try {
    const supabase = await createClient();
    // ربط الوصفة بملف الطبيب الحالي إن وُجد
    const { data: doctorRow } = await supabase
      .from("doctors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("prescriptions")
      .insert({
        clinic_id: user.clinicId,
        patient_id: parsed.data.patient_id,
        doctor_id: doctorRow?.id ?? null,
        medications: parsed.data.medications as unknown as Json,
        dosage: parsed.data.dosage ?? null,
        notes: parsed.data.notes ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data) return actionError(error?.message ?? "تعذّر إنشاء الوصفة.");

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: "create",
      entityType: "prescription",
      entityId: data.id,
      metadata: { patient_id: parsed.data.patient_id },
    });
    revalidatePath(`/patients/${parsed.data.patient_id}`);
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع.");
  }
}

/** إنشاء موعد. */
export async function createAppointment(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح.");
  if (!canManageAppointments(user.role) || !user.clinicId) {
    return actionError("ليست لديك صلاحية إضافة موعد.");
  }
  const gate = await assertClinicCanWrite(user);
  if (!gate.ok) return actionError(gate.error);

  const parsed = appointmentSchema.safeParse({
    patient_id: formData.get("patient_id"),
    doctor_id: formData.get("doctor_id"),
    scheduled_at: formData.get("scheduled_at"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return actionError("تحقق من بيانات الموعد.", z_flatten(parsed.error));
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        clinic_id: user.clinicId,
        patient_id: parsed.data.patient_id,
        doctor_id: parsed.data.doctor_id ?? null,
        scheduled_at: new Date(parsed.data.scheduled_at).toISOString(),
        notes: parsed.data.notes ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data) return actionError(error?.message ?? "تعذّر إضافة الموعد.");

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: "create",
      entityType: "appointment",
      entityId: data.id,
      metadata: { patient_id: parsed.data.patient_id },
    });
    revalidatePath(`/patients/${parsed.data.patient_id}`);
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع.");
  }
}

/** رفع ملف للمريض إلى Storage (المسار يبدأ بمعرّف العيادة لفرض العزل). */
export async function uploadPatientFile(
  patientId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح.");
  if (!canUploadFiles(user.role) || !user.clinicId) {
    return actionError("ليست لديك صلاحية رفع ملفات.");
  }
  const gate = await assertClinicCanWrite(user);
  if (!gate.ok) return actionError(gate.error);

  const file = formData.get("file");
  const fileType = String(formData.get("file_type") ?? "");
  if (!(file instanceof File) || file.size === 0) {
    return actionError("يرجى اختيار ملف.");
  }
  if (file.size > MAX_FILE_SIZE) {
    return actionError("حجم الملف يتجاوز 10 ميجابايت.");
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return actionError("نوع الملف غير مدعوم (PDF أو صورة فقط).");
  }
  if (!ALLOWED_FILE_TYPES.includes(fileType as (typeof ALLOWED_FILE_TYPES)[number])) {
    return actionError("تصنيف الملف غير صالح.");
  }

  try {
    const supabase = await createClient();
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${user.clinicId}/${patientId}/${crypto.randomUUID()}-${safeName}`;

    const { error: upErr } = await supabase.storage
      .from("patient-files")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) return actionError(`تعذّر رفع الملف: ${upErr.message}`);

    const { error: dbErr } = await supabase.from("files").insert({
      clinic_id: user.clinicId,
      patient_id: patientId,
      file_path: path,
      file_name: file.name,
      file_type: fileType,
      uploaded_by: user.id,
    });
    if (dbErr) {
      // تنظيف: حذف الملف المرفوع إن فشل تسجيله
      await supabase.storage.from("patient-files").remove([path]);
      return actionError(dbErr.message);
    }

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: "create",
      entityType: "file",
      metadata: { patient_id: patientId, file_name: file.name },
    });
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع أثناء الرفع.");
  }
}

type SignedUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** توليد رابط مؤقّت آمن (signed URL) لملف — يحترم سياسات Storage. */
export async function getFileSignedUrl(
  fileId: string,
): Promise<SignedUrlResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "غير مصرّح." };

  try {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("files")
      .select("file_path")
      .eq("id", fileId)
      .single();
    if (error || !row) return { ok: false, error: "الملف غير موجود." };

    const { data, error: signErr } = await supabase.storage
      .from("patient-files")
      .createSignedUrl(row.file_path, 120);
    if (signErr || !data) {
      return { ok: false, error: "تعذّر إنشاء الرابط." };
    }
    return { ok: true, url: data.signedUrl };
  } catch {
    return { ok: false, error: "خطأ غير متوقع." };
  }
}
