"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { actionError, type ActionResult } from "@/lib/actions";
import { clinicOnboardingSchema } from "@/lib/validation/onboarding";

/**
 * إنشاء عيادة جديدة + اشتراك مبدئي + حساب مديرها (clinic_admin).
 * متاح لـ super_admin فقط. يستخدم Admin API (Service Role) خادمياً.
 */
export async function createClinicWithAdmin(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionError("غير مصرّح. يرجى تسجيل الدخول.");
  if (user.role !== "super_admin") {
    return actionError("هذا الإجراء متاح لمدير المنصّة فقط.");
  }

  const parsed = clinicOnboardingSchema.safeParse({
    clinic_name: formData.get("clinic_name"),
    slug: formData.get("slug"),
    plan: formData.get("plan") ?? "free",
    admin_full_name: formData.get("admin_full_name"),
    admin_email: formData.get("admin_email"),
    admin_password: formData.get("admin_password"),
  });
  if (!parsed.success) {
    return actionError("تحقق من الحقول المدخلة.", z_flatten(parsed.error));
  }
  const input = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return actionError(
      "مفتاح Service Role غير مُعدّ على الخادم. أضِف SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  // 1) إنشاء العيادة
  const { data: clinic, error: clinicError } = await admin
    .from("clinics")
    .insert({ name: input.clinic_name, slug: input.slug })
    .select("id")
    .single();

  if (clinicError || !clinic) {
    if (clinicError?.code === "23505") {
      return actionError("المُعرّف (slug) مستخدم بالفعل. اختر غيره.");
    }
    return actionError(clinicError?.message ?? "تعذّر إنشاء العيادة.");
  }

  // 2) إنشاء الاشتراك المبدئي (تجريبي)
  const { error: subError } = await admin.from("subscriptions").insert({
    clinic_id: clinic.id,
    status: "trialing",
    plan: input.plan,
  });
  if (subError) {
    await admin.from("clinics").delete().eq("id", clinic.id); // تراجع
    return actionError(subError.message ?? "تعذّر إنشاء الاشتراك.");
  }

  // 3) إنشاء حساب مدير العيادة عبر Admin API (الـ trigger يُنشئ public.users)
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: input.admin_email,
    password: input.admin_password,
    email_confirm: true,
    user_metadata: {
      role: "clinic_admin",
      clinic_id: clinic.id,
      full_name: input.admin_full_name,
    },
  });

  if (userError || !created?.user) {
    // تراجع: حذف العيادة (cascade يحذف الاشتراك)
    await admin.from("clinics").delete().eq("id", clinic.id);
    return actionError(
      userError?.message?.includes("already registered")
        ? "البريد الإلكتروني مسجّل بالفعل."
        : userError?.message ?? "تعذّر إنشاء حساب المدير.",
    );
  }

  await logAudit({
    actorUserId: user.id,
    clinicId: clinic.id,
    action: "create",
    entityType: "clinic",
    entityId: clinic.id,
    metadata: {
      clinic_name: input.clinic_name,
      slug: input.slug,
      admin_email: input.admin_email,
    },
  });

  revalidatePath("/admin/clinics");
  return { ok: true };
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
