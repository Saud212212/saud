import type { SubscriptionTier } from "@/types/database";

// SaaS billing plans (Stripe Test Mode). Price IDs come from env so the same
// code works across Stripe test/live accounts without edits.
export interface Plan {
  tier: SubscriptionTier;
  name: string;
  priceMonthly: number;
  priceId: string | undefined;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    tier: "basic",
    name: "Basic",
    priceMonthly: 29,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC,
    features: ["1 doctor", "Up to 500 patients", "Appointments & invoices", "Email reminders"],
  },
  {
    tier: "pro",
    name: "Pro",
    priceMonthly: 79,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
    features: ["Up to 10 doctors", "Unlimited patients", "Analytics & reports", "File storage", "SMS reminders"],
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    priceMonthly: 199,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE,
    features: ["Unlimited doctors", "Audit logs", "Priority support", "Custom branding", "API access"],
  },
];

export function planForTier(tier: SubscriptionTier): Plan {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}
