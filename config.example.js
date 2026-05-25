/* ════════════════════════════════════════════════════════════
   EngHub Pro — PUBLIC commercial config
   ────────────────────────────────────────────────────────────
   1. Copy this file to "config.js"
   2. Fill in your PUBLIC keys (these are safe to expose client-side)
   3. NEVER put secret keys here (Stripe secret, Supabase service role)
      — those live ONLY in Supabase Edge Function secrets.
   ════════════════════════════════════════════════════════════ */
window.ENGHUB_CONFIG = {
  // From Supabase Dashboard → Project Settings → API
  SUPABASE_URL:      'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-PUBLIC-KEY',     // "anon" / "public" key — safe to expose

  // From Stripe Dashboard → Developers → API keys
  STRIPE_PUBLISHABLE_KEY: 'pk_live_or_test_xxx', // publishable key — safe to expose

  // Your Stripe Price IDs (Dashboard → Products → price_xxx)
  PRICES: {
    pro:        'price_PRO_xxx',     // $29/mo
    team:       'price_TEAM_xxx',    // $99/mo
    enterprise: 'price_ENT_xxx'      // $499/mo
  },

  // Edge Function base (usually <SUPABASE_URL>/functions/v1)
  FUNCTIONS_URL: 'https://YOUR-PROJECT.supabase.co/functions/v1'
};
