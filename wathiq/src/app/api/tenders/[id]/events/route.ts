import { api, isUuid } from "@/server/http";
import { ctxOf } from "@/server/auth/session";
import { getJobStatus } from "@/server/services/tenders";
import { notFound } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تقدم المعالجة عبر Server-Sent Events. يقرأ حالة المهمة كل ثانية (تحت RLS)
 * ويرسلها عند تغيّرها، ويُغلق عند الانتهاء أو الفشل.
 */
export const GET = api(async (s, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!isUuid(id)) throw notFound("tender");
  const ctx = ctxOf(s);
  if (!(await getJobStatus(ctx, id))) throw notFound("tender");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let last = "";
      let closed = false;
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };
      req.signal.addEventListener("abort", close);
      const deadline = Date.now() + 30 * 60_000;
      while (!closed && Date.now() < deadline) {
        const status = await getJobStatus(ctx, id).catch(() => null);
        if (!status) {
          controller.enqueue(encoder.encode(`event: gone\ndata: {}\n\n`));
          break;
        }
        const payload = JSON.stringify(status);
        if (payload !== last) {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          last = payload;
        } else {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        }
        if (status.tenderStatus === "ready" || status.tenderStatus === "failed") break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
