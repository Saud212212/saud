"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui";

interface Status {
  tenderStatus: "uploading" | "processing" | "analyzing" | "ready" | "failed";
  job: {
    kind: "extract" | "analyze";
    status: string;
    stage: string;
    progress: number;
    detail: { pagesTotal?: number; pagesSaved?: number; ocrTotal?: number; ocrDone?: number; chunksTotal?: number; chunksDone?: number };
    error: string | null;
  } | null;
}

const STAGES = {
  extract: ["prepare", "text_layer", "ocr", "chunking"],
  analyze: ["prepare", "analyze", "verify", "save"],
} as const;

/** شريط التقدم الحي عبر SSE؛ يحدّث الصفحة عند اكتمال التحليل. */
export function ProgressPanel({ tenderId, initial }: { tenderId: string; initial: Status }) {
  const t = useTranslations("progress");
  const router = useRouter();
  const [s, setS] = useState<Status>(initial);

  useEffect(() => {
    const es = new EventSource(`/api/tenders/${tenderId}/events`);
    let lastKind = initial.job?.kind;
    es.onmessage = (ev) => {
      const next = JSON.parse(ev.data) as Status;
      setS(next);
      // انتهى الاستخراج وبدأ التحليل: نحدّث الصفحة لتظهر الصفحات والمقاطع
      if (next.job?.kind !== lastKind) {
        lastKind = next.job?.kind;
        router.refresh();
      }
      if (next.tenderStatus === "ready" || next.tenderStatus === "failed") {
        es.close();
        router.refresh();
      }
    };
    es.addEventListener("gone", () => {
      es.close();
      router.push("/tenders");
    });
    return () => es.close();
  }, [tenderId, router, initial.job?.kind]);

  const job = s.job;
  const pct = job?.progress ?? 0;
  const stage = job?.stage ?? "queued";
  const failed = s.tenderStatus === "failed";
  const d = job?.detail ?? {};
  const kind = job?.kind ?? "extract";
  const stages: readonly string[] = STAGES[kind];
  const stageIdx = stages.indexOf(stage);

  return (
    <Card className="mb-6 overflow-hidden" aria-live="polite">
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            {failed ? <AlertTriangle className="h-5 w-5 text-danger" /> : <Loader2 className="h-5 w-5 animate-spin text-brand" />}
            <div>
              <div className="text-sm font-semibold">{t(kind === "analyze" ? "phaseAnalyze" : "phaseExtract")}</div>
              <div className="text-xs text-muted">{t(`stages.${failed ? "failed" : stage}` as "stages.queued")}</div>
            </div>
          </div>
          <div className="num text-2xl font-semibold text-brand">{pct}%</div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={failed ? "h-full bg-danger" : "h-full bg-brand transition-[width] duration-700"} style={{ width: `${pct}%` }} />
        </div>
        <ol className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {stages.map((st, i) => (
            <li
              key={st}
              className={
                i < stageIdx || stage === "done"
                  ? "text-ok"
                  : i === stageIdx
                    ? "font-medium text-ink"
                    : "text-muted"
              }
            >
              <span className="num me-1">{i + 1}.</span>
              {t(`stages.${st}` as "stages.queued")}
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
          {!!d.pagesTotal && <span className="num">{t("pagesLine", { done: d.pagesSaved ?? 0, total: d.pagesTotal })}</span>}
          {!!d.ocrTotal && <span className="num">{t("ocrLine", { done: d.ocrDone ?? 0, total: d.ocrTotal })}</span>}
          {!!d.chunksTotal && <span className="num">{t("chunksLine", { done: d.chunksDone ?? 0, total: d.chunksTotal })}</span>}
        </div>
        {failed ? (
          <p className="mt-3 text-sm text-danger">{t("failed")}</p>
        ) : (
          <p className="mt-3 text-xs text-muted">{t("note")}</p>
        )}
      </div>
    </Card>
  );
}
