import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";

/** المسارات العامة التي لا تتطلّب تسجيل دخول. */
const PUBLIC_PATHS = ["/login", "/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * تحديث جلسة Supabase وحماية المسارات (Optimistic check).
 * يُستدعى من proxy.ts (بديل middleware في Next.js 16).
 * ملاحظة: هذا فحص مبدئي فقط؛ التحقق النهائي من الصلاحيات يتم على الخادم وعبر RLS.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // مهم: لا تضع أي منطق بين createServerClient و getUser لتفادي مشاكل الجلسة.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // مستخدم غير مسجّل يحاول الوصول لمسار محمي → إعادة توجيه لتسجيل الدخول
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // مستخدم مسجّل يفتح صفحة تسجيل الدخول → إعادته إلى جذر التطبيق (يتولّى التوجيه حسب الدور)
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
