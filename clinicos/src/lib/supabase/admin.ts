import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * عميل Supabase بصلاحيات Service Role — يتجاوز RLS.
 * ⚠️ خادمي فقط (server-only). يُستخدم حصراً للعمليات الموثوقة على الخادم
 * مثل webhooks الخاصة بـ Stripe وإدارة المستخدمين. ممنوع استيراده في الواجهة.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY غير معرّف في بيئة الخادم.");
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
