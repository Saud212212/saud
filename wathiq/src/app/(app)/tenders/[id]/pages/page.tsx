import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, ScanLine, FileText } from "lucide-react";
import clsx from "clsx";
import { Badge, Card } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { loadTender } from "../load";
import { Stat } from "../stat";

const kindStyle: Record<string, string> = {
  text: "border-brand/25 bg-brand-soft text-brand",
  scanned: "border-accent/30 bg-accent-soft text-accent",
  hybrid: "border-accent/30 bg-accent-soft text-accent",
  broken_text: "border-accent/30 bg-accent-soft text-accent",
  blank: "border-line bg-surface-2 text-muted",
};

/** تبويب الصفحات: تصنيف كل صفحة وثقة التعرّف الضوئي (المرحلة 1). */
export default async function PagesTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail } = await loadTender(id);
  const t = await getTranslations("tender");
  const locale = await getLocale();
  const { files, pages, chunkCount } = detail;
  const lowPages = pages.filter((p) => p.lowConfidence);
  const count = (k: string[]) => pages.filter((p) => k.includes(p.kind)).length;
  const fileName = new Map(files.map((f) => [f.id, f.name]));

  return (
    <>
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
