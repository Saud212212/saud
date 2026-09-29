import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { requireSession, ctxOf } from "@/server/auth/session";
import { getPageContent, getTenderDetail } from "@/server/services/tenders";
import { AppError } from "@/server/errors";
import { isUuid } from "@/server/http";
import { Badge, PageHeader, buttonClass } from "@/components/ui";
import { PageViewer } from "./page-viewer";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; tfId: string; n: string }> };

export default async function PagePage({ params }: Params) {
  const { id, tfId, n } = await params;
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
  const total = file.pageCount ?? pageNo;

  const t = await getTranslations("viewer");
  const tt = await getTranslations("tender");
  const href = (k: number) => `/tenders/${id}/files/${tfId}/pages/${k}`;

  return (
    <>
      <PageHeader
        back={
          <Link href={`/tenders/${id}`} className="inline-flex items-center gap-1 text-muted hover:text-ink">
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
      <PageViewer
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
