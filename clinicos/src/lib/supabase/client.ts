import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * عميل Supabase للمتصفّح (Client Components).
 * يستخدم المفتاح القابل للنشر فقط — لا يُكشف أي مفتاح سرّي هنا.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
