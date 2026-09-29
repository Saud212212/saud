import { cache } from "react";
import { notFound } from "next/navigation";
import { requireSession, ctxOf } from "@/server/auth/session";
import { getTenderDetail } from "@/server/services/tenders";
import { AppError } from "@/server/errors";
import { isUuid } from "@/server/http";

/** تحميل مشترك بين التخطيط والصفحات (مرة واحدة لكل طلب). */
export const loadTender = cache(async (id: string) => {
  const session = await requireSession();
  if (!isUuid(id)) notFound();
  try {
    return { session, ctx: ctxOf(session), detail: await getTenderDetail(ctxOf(session), id) };
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  }
});

/** يحوّل not_found من الخدمات إلى 404. */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  }
}
