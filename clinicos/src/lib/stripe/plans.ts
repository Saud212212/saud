/**
 * خطط اشتراك العيادات. معرّفات الأسعار تأتي من متغيّرات البيئة (Stripe Test Mode).
 * هذا الملف لا يحوي مفاتيح سرّية، لذا يمكن استيراده في الخادم بأمان.
 */
export type PlanKey = "basic" | "pro" | "enterprise";

export type Plan = {
  key: PlanKey;
  name: string;
  priceLabel: string;
  features: string[];
  priceId: string | undefined;
};

export const PLANS: Plan[] = [
  {
    key: "basic",
    name: "Basic",
    priceLabel: "99 ر.س / شهر",
    features: ["حتى 3 مستخدمين", "إدارة المرضى والمواعيد", "فواتير أساسية"],
    priceId: process.env.STRIPE_PRICE_BASIC,
  },
  {
    key: "pro",
    name: "Pro",
    priceLabel: "299 ر.س / شهر",
    features: ["مستخدمون غير محدودين", "تقارير متقدّمة", "دعم أولوية"],
    priceId: process.env.STRIPE_PRICE_PRO,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    priceLabel: "999 ر.س / شهر",
    features: ["كل مزايا Pro", "تكاملات مخصّصة", "مدير حساب مخصّص"],
    priceId: process.env.STRIPE_PRICE_ENTERPRISE,
  },
];

/** يُعيد معرّف السعر لخطة معيّنة. */
export function priceIdForPlan(key: PlanKey): string | undefined {
  return PLANS.find((p) => p.key === key)?.priceId;
}

/** يستنتج مفتاح الخطة من معرّف السعر (يُستخدم في الويب هوك). */
export function planKeyFromPriceId(priceId: string): PlanKey | null {
  const found = PLANS.find((p) => p.priceId === priceId);
  return found?.key ?? null;
}
