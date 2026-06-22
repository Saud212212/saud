import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, UserRole } from "@/types/database";

// Server helper: load the current user's profile or redirect to /login.
// Optionally enforce a required role (redirects home on mismatch).
export async function requireUser(role?: UserRole): Promise<AppUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single<AppUser>();

  if (!profile) redirect("/login");
  if (role && profile.role !== role) {
    const { homeForRole } = await import("@/lib/rbac");
    redirect(homeForRole(profile.role));
  }
  return profile;
}
