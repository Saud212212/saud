import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "./errors";
import { getSession, type Session } from "./auth/session";

/** غلاف لمسارات API: جلسة إلزامية + تحويل الأخطاء إلى JSON بدون تسريب تفاصيل داخلية. */
export function api<Args extends unknown[]>(
  handler: (session: Session, ...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      return await handler(session, ...args);
    } catch (e) {
      if (e instanceof AppError) return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
      console.error("[api]", e);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }
  };
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
