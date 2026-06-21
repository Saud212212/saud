"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** تسجيل الخروج وإنهاء الجلسة. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
