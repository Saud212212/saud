import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { getJobStatus } from "@/server/services/tenders";
import { getAnalysisJob, listRequirements, matrixCounts } from "@/server/services/analysis";
import { PageHeader } from "@/components/ui";
import { TenderStatusBadge } from "@/components/status-badge";
import { ProgressPanel } from "./progress-panel";
import { DeleteTender } from "./delete-dialog";
import { RerunAnalysis } from "./rerun-button";
import { TenderTabs } from "./tabs";
import { loadTender } from "./load";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { detail } = await loadTender((await params).id);
  return { title: detail.tender.title };
}

export default async function TenderLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, ctx, detail } = await loadTender(id);
  const t = await getTranslations();
  const { tender, pages, chunkCount } = detail;
  const busy = tender.status === "processing" || tender.status === "uploading" || tender.status === "analyzing";
  const status = busy || tender.status === "failed" ? await getJobStatus(ctx, id) : null;
  const analysisJob = await getAnalysisJob(ctx, id);
  const analysisFailed = tender.status === "ready" && analysisJob?.status === "failed";
  const counts = analysisJob?.status === "succeeded" ? matrixCounts(await listRequirements(ctx, id)) : null;
  const canEdit = session.role !== "reviewer";

  return (
    <>
      <PageHeader
        back={
          <Link href="/tenders" className="inline-flex items-center gap-1 text-muted hover:text-ink">
            <ArrowRight className="h-4 w-4 ltr:rotate-180" />
            {t("tender.back")}
          </Link>
        }
        title={tender.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <TenderStatusBadge status={tender.status} />
            {tender.agency && <span>{tender.agency}</span>}
            {tender.referenceNumber && (
              <span>
                {t("tender.reference")}: <span className="num" dir="ltr">{tender.referenceNumber}</span>
              </span>
            )}
          </span>
        }
        actions={
          <>
            {canEdit && tender.status === "ready" && <RerunAnalysis tenderId={id} label={t("analysis.rerun")} />}
            {session.role === "owner" && <DeleteTender tenderId={id} title={tender.title} />}
          </>
        }
      />

      {status && busy && <ProgressPanel tenderId={id} initial={status} />}
      {analysisFailed && (
        <div className="mb-6 flex gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="text-sm">
            <div className="font-semibold text-danger">{t("analysis.failed", { error: (analysisJob?.error ?? "").slice(0, 160) })}</div>
            <p className="mt-1 text-ink-2">{t("analysis.failedHint")}</p>
          </div>
        </div>
      )}

      <TenderTabs
        base={`/tenders/${id}`}
        tabs={[
          { href: "", label: t("tabs.summary") },
          { href: "/compliance", label: t("tabs.compliance"), count: counts?.total, warn: false },
          { href: "/pages", label: t("tabs.pages"), count: pages.length },
          { href: "/chunks", label: t("tabs.chunks"), count: chunkCount },
        ]}
      />
      {children}
    </>
  );
}
