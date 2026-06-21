"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { actionError, type ActionResult } from "@/lib/actions";
import { staffUpdateSchema } from "@/lib/validation/staff";
import { canManageStaff } from "@/types/rbac";

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
