"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { actionError, type ActionResult } from "@/lib/actions";
import { staffUpdateSchema, staffCreateSchema } from "@/lib/validation/staff";
import { canManageStaff } from "@/types/rbac";

/**
 * إنشاء حساب دخول لموظف جديد داخل عيادة المدير الحالي.
 * يستخدم Admin API (Service Role). إن كان الدور طبيباً، يُنشأ ملف طبيب مرتبط بحسابه.
 */
export async function createStaffAccount(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح. يرجى تسجيل الدخول.");
  if (!canManageStaff(user.role) || !user.clinicId) {
    return actionError("ليست لديك صلاحية إنشاء موظفين.");
  }

  const parsed = staffCreateSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return actionError("تحقق من الحقول المدخلة.", z_flatten(parsed.error));
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return actionError(
      "مفتاح Service Role غير مُعدّ على الخادم. أضِف SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      role: parsed.data.role,
      clinic_id: user.clinicId,
      full_name: parsed.data.full_name,
    },
  });

  if (userError || !created?.user) {
    return actionError(
      userError?.message?.includes("already registered")
        ? "البريد الإلكتروني مسجّل بالفعل."
        : userError?.message ?? "تعذّر إنشاء الحساب.",
    );
  }

  // ربط الطبيب بملف طبيب
  if (parsed.data.role === "doctor") {
    const { error: docError } = await admin.from("doctors").insert({
      clinic_id: user.clinicId,
      user_id: created.user.id,
      full_name: parsed.data.full_name,
    });
    if (docError) {
      console.error("[staff] تعذّر إنشاء ملف الطبيب:", docError.message);
    }
  }

  await logAudit({
    actorUserId: user.id,
    clinicId: user.clinicId,
    action: "create",
    entityType: "user",
    entityId: created.user.id,
    metadata: { role: parsed.data.role, email: parsed.data.email },
  });

  revalidatePath("/staff");
  return { ok: true };
}

/**
 * تعديل بيانات موظف (مستخدم موجود): الاسم، الدور، حالة التفعيل.
 * ملاحظة: إنشاء حسابات دخول جديدة مؤجَّل لمرحلة لاحقة (يتطلب Service Role).
 */
export async function updateStaff(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح. يرجى تسجيل الدخول.");
  if (!canManageStaff(user.role) || !user.clinicId) {
    return actionError("ليست لديك صلاحية إدارة الموظفين.");
  }

  const parsed = staffUpdateSchema.safeParse({
    full_name: formData.get("full_name"),
    role: formData.get("role"),
    is_active: formData.get("is_active"),
  });
  if (!parsed.success) {
    return actionError("تحقق من الحقول المدخلة.", z_flatten(parsed.error));
  }

  // منع مدير العيادة من حبس نفسه (إزالة دوره أو تعطيل حسابه)
  if (id === user.id && (parsed.data.role !== "clinic_admin" || !parsed.data.is_active)) {
    return actionError("لا يمكنك تغيير دورك أو تعطيل حسابك بنفسك.");
  }

  try {
    const supabase = await createClient();

    // ربط اسم الدور بمعرّفه
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id")
      .eq("name", parsed.data.role)
      .single();

    if (roleError || !role) {
      return actionError("الدور المحدّد غير موجود.");
    }

    // RLS تضمن أن مدير العيادة لا يعدّل إلا مستخدمي عيادته
    const { data, error } = await supabase
      .from("users")
      .update({
        full_name: parsed.data.full_name,
        role_id: role.id,
        is_active: parsed.data.is_active,
      })
      .eq("id", id)
      .select("id")
      .single();

    if (error || !data) {
      return actionError(error?.message ?? "تعذّر تعديل الموظف.");
    }

    await logAudit({
      actorUserId: user.id,
      clinicId: user.clinicId,
      action: "update",
      entityType: "user",
      entityId: id,
      metadata: { role: parsed.data.role, is_active: parsed.data.is_active },
    });

    revalidatePath("/staff");
    return { ok: true };
  } catch {
    return actionError("حدث خطأ غير متوقع أثناء التعديل.");
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
