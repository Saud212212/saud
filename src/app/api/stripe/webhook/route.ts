import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { SubscriptionTier, SubscriptionStatus } from "@/types/database";

// Stripe webhook (Test Mode). Uses the service-role client so it can update
// clinics/subscriptions regardless of RLS. Configure the endpoint secret via
// STRIPE_WEBHOOK_SECRET and point Stripe at /api/stripe/webhook.
export async function POST(req: Request) {
  const stripe = getStripe();
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing signature/secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  const admin = createServiceClient();

  const tierFromPrice = (priceId?: string): SubscriptionTier => {
    if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE) return "enterprise";
    if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) return "pro";
    return "basic";
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clinicId = session.metadata?.clinic_id;
      if (clinicId && session.subscription) {
        await admin
          .from("clinics")
          .update({
            stripe_subscription_id: session.subscription as string,
            subscription_status: "active",
          })
          .eq("id", clinicId);
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.created":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const clinicId = sub.metadata?.clinic_id;
      const priceId = sub.items.data[0]?.price.id;
      const tier = tierFromPrice(priceId);
      const status = (event.type === "customer.subscription.deleted"
        ? "canceled"
        : sub.status) as SubscriptionStatus;

      if (clinicId) {
        await admin
          .from("clinics")
          .update({ subscription_tier: tier, subscription_status: status })
          .eq("id", clinicId);

        await admin.from("subscriptions").upsert(
          {
            clinic_id: clinicId,
            stripe_subscription_id: sub.id,
            stripe_price_id: priceId,
            tier,
            status,
            cancel_at_period_end: sub.cancel_at_period_end,
            current_period_end: sub.items.data[0]?.current_period_end
              ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
              : null,
          },
          { onConflict: "stripe_subscription_id" }
        );
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      await admin
        .from("clinics")
        .update({ subscription_status: "past_due" })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      await admin
        .from("clinics")
        .update({ subscription_status: "active" })
        .eq("stripe_customer_id", customerId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
