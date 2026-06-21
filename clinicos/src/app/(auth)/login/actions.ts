"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginFormState } from "@/lib/validation/auth";
import { homePathForRole } from "@/types/rbac";

/**
 * Server Action لتسجيل الدخول.
 * التحقق من المدخلات يتم على الخادم، ثم المصادقة عبر Supabase،
 * ثم التوجيه إلى لوحة الدور المناسب.
 */
export async function login(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  // 1) التحقق من المدخلات على الخادم
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      errors: z_flatten(parsed.error),
    };
  }

  // 2) المصادقة عبر Supabase
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { message: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
  }

  // 3) جلب دور المستخدم للتوجيه الصحيح
  const { data: profile } = await supabase
    .from("users")
    .select("roles(name)")
    .eq("id", data.user.id)
    .single();

  const roleName = profile?.roles?.name ?? null;

  // التوجيه خارج كتلة try لأن redirect يرمي استثناءً داخلياً
  redirect(homePathForRole(roleName));
}

/** تحويل أخطاء Zod إلى شكل LoginFormState.errors. */
function z_flatten(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): NonNullable<LoginFormState>["errors"] {
  const out: { email?: string[]; password?: string[] } = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === "email") (out.email ??= []).push(issue.message);
    if (key === "password") (out.password ??= []).push(issue.message);
  }
  return out;
}
