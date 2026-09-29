import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { requireSession, ctxOf } from "@/server/auth/session";
import { getPageContent, getTenderDetail } from "@/server/services/tenders";
import { getFact, getRequirement } from "@/server/services/analysis";
import type { HighlightRect } from "@/server/analysis/verify";
import { VerificationBadge, type Verification } from "@/components/verification-badge";
import { AppError } from "@/server/errors";
import { isUuid } from "@/server/http";
import { Badge, Card, PageHeader, buttonClass } from "@/components/ui";
import { PageViewer } from "./page-viewer";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; tfId: string; n: string }>; searchParams: Promise<{ req?: string; fact?: string }> };

export default async function PagePage({ params, searchParams }: Params) {
  const { id, tfId, n } = await params;
  const { req, fact } = await searchParams;
  const pageNo = Number(n);
  if (!isUuid(id) || !isUuid(tfId) || !Number.isInteger(pageNo) || pageNo < 1) notFound();
  const session = await requireSession();
  const ctx = ctxOf(session);

  let detail, page;
  try {
    [detail, page] = await Promise.all([getTenderDetail(ctx, id), getPageContent(ctx, id, tfId, pageNo)]);
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  }
  const file = detail.files.find((f) => f.id === tfId);
  if (!file) notFound();

  // الموضع المطلوب إبرازه: متطلب من المصفوفة أو حقل من الملخص
  let focus: { title: string; text: string; quote: string | null; status: Verification; reasons: string[]; rects: HighlightRect[] } | null = null;
  const tm = await getTranslations("summary");
  if (req && isUuid(req)) {
    const r = await getRequirement(ctx, id, req).catch(() => null);
    if (r) focus = { title: r.code, text: r.text, quote: r.source.quote, status: r.source.verification, reasons: r.source.reasons, rects: r.source.rects };
  } else if (fact && isUuid(fact)) {
    const f = await getFact(ctx, id, fact).catch(() => null);
    if (f)
      focus = {
        title: tm(`fields.${f.field}` as "fields.entity"),
        text: String(f.value.value ?? f.value.name ?? ""),
        quote: f.source.quote,
        status: f.source.verification,
        reasons: f.source.reasons,
        rects: f.source.rects,
      };
  }
  const highlights = (focus?.rects ?? []).filter((r) => r.page === pageNo).map((r) => r.b);
  const total = file.pageCount ?? pageNo;

  const t = await getTranslations("viewer");
  const tt = await getTranslations("tender");
  const qs = req ? `?req=${req}` : fact ? `?fact=${fact}` : "";
  const href = (k: number) => `/tenders/${id}/files/${tfId}/pages/${k}${qs}`;
  const tv = await getTranslations("viewer2");

  return (
    <>
      <PageHeader
        back={
          <Link href={`/tenders/${id}${req ? "/compliance" : fact ? "" : "/pages"}`} className="inline-flex items-center gap-1 text-muted hover:text-ink">
            <ArrowRight className="h-4 w-4 ltr:rotate-180" />
            {t("backToTender")}
          </Link>
        }
        title={
          <span>
            {tt("page")} <span className="num">{pageNo}</span>
            <span className="text-muted"> / </span>
            <span className="num text-muted">{total}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span dir="auto">{file.name}</span>
            <Badge tone={page.kind === "text" ? "brand" : "accent"}>{tt(`kinds.${page.kind}`)}</Badge>
            <Badge>{tt(`sources.${page.source}`)}</Badge>
            {page.ocrConfidence !== null && (
              <Badge tone={page.lowConfidence ? "warn" : "ok"}>
                {tt("confidence")}: <span className="num">{Math.round(page.ocrConfidence)}%</span>
              </Badge>
            )}
            <span className="num text-xs">
              {page.wordCount} {tt("words")} · {page.charCount} {tt("chars")}
            </span>
          </span>
        }
        actions={
          <>
            {pageNo > 1 ? (
              <Link href={href(pageNo - 1)} className={buttonClass("secondary")}>
                <ChevronRight className="h-4 w-4 ltr:rotate-180" />
                {t("prev")}
              </Link>
            ) : null}
            {pageNo < total ? (
              <Link href={href(pageNo + 1)} className={buttonClass("secondary")}>
                {t("next")}
                <ChevronLeft className="h-4 w-4 ltr:rotate-180" />
              </Link>
            ) : null}
          </>
        }
      />
      {focus && (
        <Card className="mb-5 border-accent/40 p-4">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="num font-semibold">{focus.title}</span>
            <VerificationBadge status={focus.status} reasons={focus.reasons} />
            <span className="text-xs text-muted">{highlights.length ? tv("highlighted") : tv("noHighlight")}</span>
          </div>
          <p className="text-sm leading-7" dir="auto">
            {focus.text}
          </p>
          {focus.quote && (
            <p className="mt-1 border-s-2 border-accent ps-3 text-xs text-muted" dir="auto">
              {tv("quote")}: «{focus.quote}»
            </p>
          )}
        </Card>
      )}
      <PageViewer
        highlights={highlights}
        fileUrl={`/api/tenders/${id}/files/${file.fileId}`}
        pageNo={pageNo}
        words={page.content.words}
        text={page.content.text}
        width={page.width}
        height={page.height}
      />
    </>
  );
}
