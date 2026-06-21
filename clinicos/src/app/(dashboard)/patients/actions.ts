"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { actionError, type ActionResult } from "@/lib/actions";
import { patientSchema } from "@/lib/validation/patients";
import { canManagePatients } from "@/types/rbac";

/** يستخرج بيانات المريض من FormData ويتحقق منها على الخادم. */
function parsePatient(formData: FormData) {
  return patientSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    gender: formData.get("gender"),
    age: formData.get("age"),
    date_of_birth: formData.get("date_of_birth"),
    address: formData.get("address"),
  });
}

/** إنشاء مريض جديد. */
export async function createPatient(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح. يرجى تسجيل الدخول.");
  if (!canManagePatients(user.role) || !user.clinicId) {
    return actionError("ليست لديك صلاحية إضافة مريض.");
  }

  const parsed = parsePatient(formData);
  if (!parsed.success) {
    return actionError("تحقق من الحقول المدخلة.", z_flatten(parsed.error));
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("patients")
      .insert({ ...parsed.data, clinic_id: user.clinicId })
      .select("id, file_number")
      .single();

    if (error || !data) {
      return actionError(error?.message ?? "تعذّر إنشاء المريض.");
    }

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: "create",
      entityType: "patient",
      entityId: data.id,
      metadata: { file_number: data.file_number, full_name: parsed.data.full_name },
    });

    revalidatePath("/patients");
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع أثناء إنشاء المريض.");
  }
}

/** تعديل مريض موجود. */
export async function updatePatient(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح. يرجى تسجيل الدخول.");
  if (!canManagePatients(user.role)) {
    return actionError("ليست لديك صلاحية تعديل المريض.");
  }

  const parsed = parsePatient(formData);
  if (!parsed.success) {
    return actionError("تحقق من الحقول المدخلة.", z_flatten(parsed.error));
  }

  try {
    const supabase = await createClient();
    // RLS تضمن أن المستخدم لا يعدّل إلا مريض عيادته
    const { data, error } = await supabase
      .from("patients")
      .update(parsed.data)
      .eq("id", id)
      .select("id")
      .single();

    if (error || !data) {
      return actionError(error?.message ?? "تعذّر تعديل المريض.");
    }

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: "update",
      entityType: "patient",
      entityId: id,
      metadata: { full_name: parsed.data.full_name },
    });

    revalidatePath("/patients");
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع أثناء التعديل.");
  }
}

/** أرشفة/استعادة مريض (soft delete). */
export async function setPatientActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح. يرجى تسجيل الدخول.");
  if (!canManagePatients(user.role)) {
    return actionError("ليست لديك صلاحية تنفيذ هذا الإجراء.");
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("patients")
      .update({ is_active: isActive })
      .eq("id", id)
      .select("id")
      .single();

    if (error || !data) {
      return actionError(error?.message ?? "تعذّر تنفيذ الإجراء.");
    }

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: isActive ? "restore" : "archive",
      entityType: "patient",
      entityId: id,
    });

    revalidatePath("/patients");
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع.");
  }
}

/** تحويل أخطاء Zod إلى خريطة حقول. */
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
