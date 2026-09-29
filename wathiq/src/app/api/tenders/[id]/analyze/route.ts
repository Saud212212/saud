import { NextResponse } from "next/server";
import { api, isUuid } from "@/server/http";
import { ctxOf, requestMeta } from "@/server/auth/session";
import { requestAnalysis } from "@/server/services/analysis";
import { notFound } from "@/server/errors";

export const runtime = "nodejs";

/** إعادة تشغيل التحليل (محرر أو مالك). يستبدل النتائج السابقة بالكامل. */
export const POST = api(async (s, _req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!isUuid(id)) throw notFound("tender");
  const jobId = await requestAnalysis(ctxOf(s), id, await requestMeta());
  return NextResponse.json({ jobId }, { status: 202 });
});
