import { NextResponse } from "next/server";
import { api, isUuid } from "@/server/http";
import { ctxOf, requestMeta } from "@/server/auth/session";
import { getTenderDetail, hardDeleteTender } from "@/server/services/tenders";
import { notFound } from "@/server/errors";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api(async (s, _req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!isUuid(id)) throw notFound("tender");
  return NextResponse.json(await getTenderDetail(ctxOf(s), id));
});

/** حذف نهائي — للمالك فقط (يُتحقق من الدور داخل الخدمة من قاعدة البيانات). */
export const DELETE = api(async (s, _req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!isUuid(id)) throw notFound("tender");
  return NextResponse.json(await hardDeleteTender(ctxOf(s), id, await requestMeta()));
});
