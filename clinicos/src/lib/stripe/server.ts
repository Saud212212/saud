import "server-only";

import Stripe from "stripe";

/**
 * عميل Stripe الخادمي. المفتاح السرّي لا يُكشف أبداً في الواجهة.
 * يُهيّأ كسالب (lazy) حتى لا يفشل البناء عند غياب المفتاح في بيئات بلا Stripe.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY غير مُعدّ على الخادم.");
  }
  _stripe = new Stripe(key);
  return _stripe;
}

/** هل تكامل Stripe مُهيّأ (المفتاح موجود)؟ */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
