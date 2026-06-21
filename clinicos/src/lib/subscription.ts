import { createClient } from "@/lib/supabase/server";

/** الحالات التي تُعتبر فيها العيادة فعّالة (يُسمح بالكتابة). */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** هل حالة الاشتراك تسمح بالاستخدام الكامل؟ */
export function isSubscriptionActive(status: string | null | undefined): boolean {
  return !!status && ACTIVE_STATUSES.has(status);
}

/**
 * يجلب حالة اشتراك العيادة الحالية. يُعيد null إن لم توجد عيادة/اشتراك.
 * super_admin (بلا عيادة) يُعتبر فعّالاً دائماً.
 */
export async function getClinicSubscriptionStatus(
  clinicId: string | null,
): Promise<string | null> {
  if (!clinicId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("clinic_id", clinicId)
    .single();
  return data?.status ?? null;
}

/**
 * يتحقق أن عيادة المستخدم تسمح بعمليات الكتابة.
 * super_admin مستثنى. تُستخدم داخل Server Actions قبل أي إنشاء/تعديل.
 */
export async function assertClinicCanWrite(user: {
  role: string;
  clinicId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (user.role === "super_admin") return { ok: true };
  const status = await getClinicSubscriptionStatus(user.clinicId);
  if (!isSubscriptionActive(status)) {
    return {
      ok: false,
      error: "اشتراك العيادة غير فعّال. يرجى تجديد الاشتراك للمتابعة.",
    };
  }
  return { ok: true };
}
