import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

/**
 * عميل Supabase للخادم (Server Components / Server Actions / Route Handlers).
 * في Next.js 16 الدالة cookies() غير متزامنة (async).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // قد يُستدعى setAll من Server Component حيث لا يمكن الكتابة؛
            // يُتجاهَل بأمان لأن تحديث الجلسة يتم في الـ proxy.
          }
        },
      },
    },
  );
}
