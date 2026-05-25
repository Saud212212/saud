// ════════════════════════════════════════════════════════════
//  Edge Function: stripe-webhook
//  Keeps subscription status in sync when Stripe sends events.
//  Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
//  Secrets: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
//  Then in Stripe → Developers → Webhooks → add endpoint:
//    <SUPABASE_URL>/functions/v1/stripe-webhook
//    events: checkout.session.completed,
//            customer.subscription.updated,
//            customer.subscription.deleted
// ════════════════════════════════════════════════════════════
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// Service-role client bypasses RLS to update subscriptions
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Map Stripe price → tier (mirror your config PRICES)
function priceToTier(priceId: string): string {
  const map: Record<string, string> = {
    [Deno.env.get('PRICE_PRO') ?? '']: 'pro',
    [Deno.env.get('PRICE_TEAM') ?? '']: 'team',
    [Deno.env.get('PRICE_ENT') ?? '']: 'enterprise',
  };
  return map[priceId] ?? 'pro';
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret);
  } catch (e) {
    return new Response(`Webhook signature failed: ${e.message}`, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as Stripe.Checkout.Session;
      const uid = s.metadata?.supabase_uid;
      const subId = s.subscription as string;
      const sub = await stripe.subscriptions.retrieve(subId);
      const priceId = sub.items.data[0]?.price.id ?? '';
      if (uid) {
        await admin.from('subscriptions').upsert({
          user_id: uid,
          stripe_customer_id: s.customer as string,
          stripe_subscription_id: subId,
          status: sub.status,
          tier: priceToTier(priceId),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      }
    }

    if (event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.supabase_uid;
      const priceId = sub.items.data[0]?.price.id ?? '';
      // Find by stripe_subscription_id if metadata missing
      const match = uid
        ? { user_id: uid }
        : { stripe_subscription_id: sub.id };
      await admin.from('subscriptions').update({
        status: event.type.endsWith('deleted') ? 'canceled' : sub.status,
        tier: event.type.endsWith('deleted') ? 'free' : priceToTier(priceId),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).match(match);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(`Handler error: ${e.message}`, { status: 500 });
  }
});
