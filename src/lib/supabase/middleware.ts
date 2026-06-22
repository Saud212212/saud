import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/types/database";
import { homeForRole } from "@/lib/rbac";

const PUBLIC_PATHS = ["/", "/login", "/register", "/auth/callback", "/pricing"];

// Refreshes the Supabase session and enforces route protection + RBAC.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // If Supabase isn't configured yet (e.g. env vars not set on the host),
  // pass requests through so public pages still render instead of 500-ing.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() must be called to refresh the auth token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith("/auth/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  // Role-gate the dashboard areas.
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role as UserRole | undefined;

    const guards: Record<string, UserRole> = {
      "/admin": "super_admin",
      "/dashboard": "clinic_admin",
      "/doctor": "doctor",
      "/reception": "receptionist",
    };

    for (const [prefix, required] of Object.entries(guards)) {
      if (path.startsWith(prefix) && role && role !== required) {
        const url = request.nextUrl.clone();
        url.pathname = homeForRole(role);
        return NextResponse.redirect(url);
      }
    }

    // Authenticated users shouldn't sit on the landing/auth screens.
    if ((path === "/" || path === "/login" || path === "/register") && role) {
      const url = request.nextUrl.clone();
      url.pathname = homeForRole(role);
      return NextResponse.redirect(url);
    }
  }

  return response;
}
