import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function POST(req: Request) {
  const { clinicName, fullName, email, password } = await req.json();

  if (!clinicName || !fullName || !email || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const admin = createServiceClient();

  // Unique slug.
  const base = slugify(clinicName) || "clinic";
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 14);

  const { data: clinic, error: clinicError } = await admin
    .from("clinics")
    .insert({ name: clinicName, slug, email, trial_ends_at: trialEnds.toISOString() })
    .select("id")
    .single();

  if (clinicError || !clinic) {
    return NextResponse.json({ error: clinicError?.message ?? "Could not create clinic" }, { status: 500 });
  }

  // Create the auth user; handle_new_user trigger provisions public.users.
  const { error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, clinic_id: clinic.id, role: "clinic_admin" },
  });

  if (userError) {
    // Roll back the clinic so the email can be retried cleanly.
    await admin.from("clinics").delete().eq("id", clinic.id);
    return NextResponse.json({ error: userError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, clinicId: clinic.id });
}
