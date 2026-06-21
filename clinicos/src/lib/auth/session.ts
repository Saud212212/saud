import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homePathForRole, isAppRole, type AppRole } from "@/types/rbac";

/** ملف المستخدم الحالي مع دوره وعيادته. */
export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  clinicId: string | null;
};

/**
 * يجلب المستخدم الحالي مع دوره وعيادته من قاعدة البيانات.
 * يُعيد null إن لم يكن مسجّلاً أو لم يُكتمل ملفه.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // قراءة الملف مع اسم الدور (RLS تضمن أن المستخدم يرى صفّه)
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, clinic_id, roles(name)")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return null;
  }

  const roleName = data.roles?.name;
  if (!isAppRole(roleName)) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: roleName,
    clinicId: data.clinic_id,
  };
}

/**
 * يضمن وجود مستخدم مسجّل وإلا يُعيد توجيهه لتسجيل الدخول.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * يضمن أن المستخدم الحالي يملك أحد الأدوار المسموح بها،
 * وإلا يُعيد توجيهه إلى لوحته الصحيحة.
 */
export async function requireRole(
  allowed: readonly AppRole[],
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    redirect(homePathForRole(user.role));
  }
  return user;
}
