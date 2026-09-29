import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, ArrowRight, Layers, ScanLine, FileText } from "lucide-react";
import clsx from "clsx";
import { requireSession, ctxOf } from "@/server/auth/session";
import { getJobStatus, getTenderDetail } from "@/server/services/tenders";
import { AppError } from "@/server/errors";
import { isUuid } from "@/server/http";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { TenderStatusBadge } from "@/components/status-badge";
import { formatBytes } from "@/lib/format";
import { ProgressPanel } from "./progress-panel";
import { DeleteTender } from "./delete-dialog";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  const session = await requireSession();
  if (!isUuid(id)) notFound();
  try {
    return { session, detail: await getTenderDetail(ctxOf(session), id) };
  } catch (e) {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: Params) {
  const { detail } = await load((await params).id);
  return { title: detail.tender.title };
}

const kindStyle: Record<string, string> = {
  text: "border-brand/25 bg-brand-soft text-brand",
  scanned: "border-accent/30 bg-accent-soft text-accent",
  hybrid: "border-accent/30 bg-accent-soft text-accent",
  broken_text: "border-accent/30 bg-accent-soft text-accent",
  blank: "border-line bg-surface-2 text-muted",
};

export default async function TenderPage({ params }: Params) {
  const { id } = await params;
  const { session, detail } = await load(id);
  const t = await getTranslations("tender");
  const locale = await getLocale();
  const { tender, files, pages, chunkCount } = detail;
  const inProgress = tender.status === "processing" || tender.status === "uploading" || tender.status === "failed";
  const status = inProgress ? await getJobStatus(ctxOf(session), id) : null;

  const lowPages = pages.filter((p) => p.lowConfidence);
  const count = (k: string[]) => pages.filter((p) => k.includes(p.kind)).length;
  const fileName = new Map(files.map((f) => [f.id, f.name]));

  return (
    <>
      <PageHeader
        back={
          <Link href="/tenders" className="inline-flex items-center gap-1 text-muted hover:text-ink">
            <ArrowRight className="h-4 w-4 ltr:rotate-180" />
            {t("back")}
          </Link>
        }
        title={tender.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-3">
            <TenderStatusBadge status={tender.status} />
            {tender.referenceNumber && (
              <span>
                {t("reference")}: <span className="num" dir="ltr">{tender.referenceNumber}</span>
              </span>
            )}
          </span>
        }
        actions={
          <>
            {chunkCount > 0 && (
              <LinkButton variant="secondary" href={`/tenders/${id}/chunks`}>
                <Layers className="h-4 w-4" />
                {t("viewChunks")}
              </LinkButton>
            )}
            {session.role === "owner" && <DeleteTender tenderId={id} title={tender.title} />}
          </>
        }
      />

      {status && tender.status !== "ready" && <ProgressPanel tenderId={id} initial={status} />}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("files")} value={files.length} />
        <Stat label={t("pages")} value={pages.length} hint={t("kindStats", { text: count(["text"]), scanned: count(["scanned"]), other: count(["hybrid", "broken_text", "blank"]) })} />
        <Stat label={t("chunks")} value={chunkCount} />
        <Stat label={t("lowBadge")} value={lowPages.length} tone={lowPages.length ? "warn" : undefined} />
      </div>

      {lowPages.length > 0 && (
        <div className="mb-6 flex gap-3 rounded-xl border border-warn/30 bg-warn-soft p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-warn">{t("weakPagesTitle", { count: lowPages.length })}</div>
            <p className="mt-1 text-sm leading-6 text-ink-2">{t("weakPagesBody")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {lowPages.map((p) => (
                <Link
                  key={`${p.tenderFileId}-${p.pageNo}`}
                  href={`/tenders/${id}/files/${p.tenderFileId}/pages/${p.pageNo}`}
                  className="rounded-md border border-warn/30 bg-surface px-2 py-1 text-xs hover:border-warn"
                >
                  <span dir="auto">{fileName.get(p.tenderFileId)}</span> · {t("page")} <span className="num">{p.pageNo}</span>
                  {p.ocrConfidence !== null && <span className="num text-muted"> ({Math.round(p.ocrConfidence)}%)</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <h2 className="mb-3 text-base font-semibold">{t("overview")}</h2>
      <div className="space-y-4">
        {files.map((f) => {
          const fp = pages.filter((p) => p.tenderFileId === f.id);
          return (
            <Card key={f.id} className="p-5">
              <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
                <FileText className="h-5 w-5 text-muted" />
                <span className="font-medium" dir="auto">
                  {f.name}
                </span>
                <Badge>{t(`fileRoles.${f.role}`)}</Badge>
                <span className="num text-xs text-muted">
                  {formatBytes(f.sizeBytes, locale)}
                  {f.pageCount ? ` · ${t("pageCount", { count: f.pageCount })}` : ""}
                </span>
              </div>
              {fp.length === 0 ? (
                <div className="h-12 animate-pulse rounded-lg bg-surface-2" />
              ) : (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                  {fp.map((p) => (
                    <li key={p.pageNo}>
                      <Link
                        href={`/tenders/${id}/files/${f.id}/pages/${p.pageNo}`}
                        title={`${t(`kinds.${p.kind}`)} · ${t(`sources.${p.source}`)}${p.ocrConfidence !== null ? ` · ${Math.round(p.ocrConfidence)}%` : ""}`}
                        className={clsx(
                          "relative block rounded-lg border px-2.5 py-2 transition-shadow hover:shadow-sm",
                          kindStyle[p.kind],
                          p.lowConfidence && "ring-2 ring-warn/60",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="num text-sm font-semibold">{p.pageNo}</span>
                          {p.source === "ocr" ? <ScanLine className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5 opacity-60" />}
                        </div>
                        <div className="mt-1 truncate text-[11px]">{t(`kinds.${p.kind}`)}</div>
                        {p.ocrConfidence !== null && p.source === "ocr" && (
                          <div className={clsx("num text-[11px]", p.lowConfidence ? "font-semibold text-warn" : "opacity-70")}>
                            {Math.round(p.ocrConfidence)}%
                          </div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "warn" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={clsx("num mt-1 text-2xl font-semibold", tone === "warn" ? "text-warn" : "text-ink")}>{value}</div>
      {hint && <div className="num mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}
