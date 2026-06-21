import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy (بديل Middleware في Next.js 16).
 * يحدّث جلسة Supabase ويحمي المسارات قبل اكتمال الطلب.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * مطابقة كل المسارات عدا:
     * - _next/static, _next/image (ملفات Next الثابتة)
     * - favicon والصور
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
