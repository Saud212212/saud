"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { priceIdForPlan, type PlanKey } from "@/lib/stripe/plans";

type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** إنشاء جلسة Stripe Checkout لاشتراك العيادة (وضع subscription). */
export async function createSubscriptionCheckout(
  planKey: PlanKey,
): Promise<CheckoutResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "غير مصرّح." };
  if (user.role !== "clinic_admin" || !user.clinicId) {
    return { ok: false, error: "إدارة الاشتراك متاحة لمدير العيادة فقط." };
  }
  if (!isStripeConfigured()) {
    return { ok: false, error: "تكامل Stripe غير مُعدّ على الخادم." };
  }

  const priceId = priceIdForPlan(planKey);
  if (!priceId) {
    return { ok: false, error: "معرّف سعر الخطة غير مُعدّ." };
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      success_url: `${appUrl}/billing?success=1`,
      cancel_url: `${appUrl}/billing?canceled=1`,
      metadata: { type: "subscription", clinic_id: user.clinicId, plan: planKey },
      subscription_data: {
        metadata: { clinic_id: user.clinicId, plan: planKey },
      },
    });
    if (!session.url) return { ok: false, error: "تعذّر إنشاء جلسة الدفع." };
    return { ok: true, url: session.url };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "خطأ غير متوقع.",
    };
  }
}
