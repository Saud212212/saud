"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { actionError, type ActionResult } from "@/lib/actions";
import { doctorSchema } from "@/lib/validation/doctors";
import { canManageDoctors } from "@/types/rbac";

function parseDoctor(formData: FormData) {
  return doctorSchema.safeParse({
    full_name: formData.get("full_name"),
    specialty: formData.get("specialty"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    license_number: formData.get("license_number"),
  });
}

export async function createDoctor(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح. يرجى تسجيل الدخول.");
  if (!canManageDoctors(user.role) || !user.clinicId) {
    return actionError("ليست لديك صلاحية إضافة طبيب.");
  }

  const parsed = parseDoctor(formData);
  if (!parsed.success) {
    return actionError("تحقق من الحقول المدخلة.", z_flatten(parsed.error));
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("doctors")
      .insert({ ...parsed.data, clinic_id: user.clinicId })
      .select("id")
      .single();

    if (error || !data) {
      return actionError(error?.message ?? "تعذّر إنشاء الطبيب.");
    }

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: "create",
      entityType: "doctor",
      entityId: data.id,
      metadata: { full_name: parsed.data.full_name },
    });

    revalidatePath("/doctors");
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع أثناء إنشاء الطبيب.");
  }
}

export async function updateDoctor(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح. يرجى تسجيل الدخول.");
  if (!canManageDoctors(user.role)) {
    return actionError("ليست لديك صلاحية تعديل الطبيب.");
  }

  const parsed = parseDoctor(formData);
  if (!parsed.success) {
    return actionError("تحقق من الحقول المدخلة.", z_flatten(parsed.error));
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("doctors")
      .update(parsed.data)
      .eq("id", id)
      .select("id")
      .single();

    if (error || !data) {
      return actionError(error?.message ?? "تعذّر تعديل الطبيب.");
    }

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: "update",
      entityType: "doctor",
      entityId: id,
      metadata: { full_name: parsed.data.full_name },
    });

    revalidatePath("/doctors");
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع أثناء التعديل.");
  }
}

export async function setDoctorActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح. يرجى تسجيل الدخول.");
  if (!canManageDoctors(user.role)) {
    return actionError("ليست لديك صلاحية تنفيذ هذا الإجراء.");
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("doctors")
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
      entityType: "doctor",
      entityId: id,
    });

    revalidatePath("/doctors");
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع.");
  }
}

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
