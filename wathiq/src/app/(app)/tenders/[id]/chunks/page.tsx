import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { requireSession, ctxOf } from "@/server/auth/session";
import { getTenderDetail, listChunks } from "@/server/services/tenders";
import { AppError } from "@/server/errors";
import { isUuid } from "@/server/http";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ChunksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const session = await requireSession();
  let detail, chunks;
  try {
    [detail, chunks] = await Promise.all([getTenderDetail(ctxOf(session), id), listChunks(ctxOf(session), id)]);
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  }
  const t = await getTranslations("chunks");
  const tt = await getTranslations("tender");
  const files = new Map(detail.files.map((f) => [f.id, f.name]));

  return (
    <>
      <p className="mb-4 text-sm text-muted">{t("subtitle")}</p>
      <div className="space-y-3">
        {chunks.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="num font-semibold text-ink">#{c.ordinal + 1}</span>
              <span dir="auto">{files.get(c.tenderFileId)}</span>
              {c.spans.map((s, i) => (
                <Link key={i} href={`/tenders/${id}/files/${c.tenderFileId}/pages/${s.page}`} className="hover:text-brand">
                  <Badge tone="brand">
                    {tt("page")} <span className="num">{s.page}</span>
                  </Badge>
                </Link>
              ))}
              {c.sectionRef && <Badge tone="accent">{t("section", { ref: c.sectionRef })}</Badge>}
              <span className="num">{t("tokens", { n: c.tokenEstimate })}</span>
            </div>
            {c.heading && !c.text.startsWith(c.heading) && <div className="mb-1 text-xs font-semibold text-muted">{c.heading}</div>}
            <p className="line-clamp-6 text-sm leading-7 whitespace-pre-wrap text-ink-2" dir="auto">
              {c.text}
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}
