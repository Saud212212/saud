import { api, isUuid } from "@/server/http";
import { ctxOf, requestMeta } from "@/server/auth/session";
import { readTenderFile } from "@/server/services/tenders";
import { notFound } from "@/server/errors";

export const runtime = "nodejs";

/** الملف الأصلي مفكوك التشفير لعارض PDF. لا يُخزَّن في ذاكرة المتصفح المؤقتة. */
export const GET = api(async (s, _req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) => {
  const { id, fileId } = await params;
  if (!isUuid(id) || !isUuid(fileId)) throw notFound("file");
  const file = await readTenderFile(ctxOf(s), id, fileId, await requestMeta());
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
    },
  });
});
