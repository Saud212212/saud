import { NextResponse } from "next/server";
import { z } from "zod";
import { api, isUuid } from "@/server/http";
import { ctxOf, requestMeta } from "@/server/auth/session";
import { resolveSimilarGroup } from "@/server/services/analysis";
import { invalid, notFound } from "@/server/errors";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("action", [
  z.object({ groupId: z.string().uuid(), action: z.literal("keep_all") }),
  z.object({ groupId: z.string().uuid(), action: z.literal("merge"), keepId: z.string().uuid() }),
]);

/** قرار المستخدم لمجموعة "متطلبات متشابهة، راجع الدمج". */
export const POST = api(async (s, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!isUuid(id)) throw notFound("tender");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw invalid("invalid body");
  const { groupId, ...decision } = parsed.data;
  return NextResponse.json(await resolveSimilarGroup(ctxOf(s), id, groupId, decision, await requestMeta()));
});
