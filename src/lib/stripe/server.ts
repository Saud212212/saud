import Stripe from "stripe";

// Server-side Stripe client (Test Mode). Lazily instantiated so the app can
// build and render marketing pages without the secret key configured.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    // Uses the SDK's pinned API version; no need to hard-code a version string.
    _stripe = new Stripe(key);
  }
  return _stripe;
}
