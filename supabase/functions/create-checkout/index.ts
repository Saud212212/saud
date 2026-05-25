// ════════════════════════════════════════════════════════════
//  Edge Function: create-checkout
//  Creates a Stripe Checkout Session for a logged-in user.
//  Deploy:  supabase functions deploy create-checkout
//  Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
//                                 FRONTEND_URL=https://saud212212.github.io/saud
// ════════════════════════════════════════════════════════════
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const FRONTEND = Deno.env.get('FRONTEND_URL') ?? 'https://saud212212.github.io/saud';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { priceId } = await req.json();
    if (!priceId) throw new Error('priceId is required');

    // Identify the user from their Supabase JWT
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) throw new Error('Not authenticated');

    // Reuse or create Stripe customer
    const { data: sub } = await supabase
      .from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).single();

    let customerId = sub?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email, metadata: { supabase_uid: user.id },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND}/index.html#projects-hub?paid=1`,
      cancel_url: `${FRONTEND}/index.html#pricing`,
      allow_promotion_codes: true,
      metadata: { supabase_uid: user.id },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
