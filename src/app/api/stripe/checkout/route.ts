import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import type { Clinic } from "@/types/database";

// Creates a Stripe Checkout Session for the calling clinic's subscription.
// Body: { priceId: string }
export async function POST(req: Request) {
  const { priceId } = await req.json();
  if (!priceId) {
    return NextResponse.json({ error: "priceId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.clinic_id || profile.role !== "clinic_admin") {
    return NextResponse.json({ error: "Only clinic admins can manage billing" }, { status: 403 });
  }

  const { data: clinic } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", profile.clinic_id)
    .single<Clinic>();
  if (!clinic) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Reuse or create the Stripe customer.
  let customerId = clinic.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: clinic.email ?? user.email,
      name: clinic.name,
      metadata: { clinic_id: clinic.id },
    });
    customerId = customer.id;
    await supabase.from("clinics").update({ stripe_customer_id: customerId }).eq("id", clinic.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing?status=success`,
    cancel_url: `${appUrl}/dashboard/billing?status=cancelled`,
    metadata: { clinic_id: clinic.id },
    subscription_data: { metadata: { clinic_id: clinic.id } },
  });

  return NextResponse.json({ url: session.url });
}
