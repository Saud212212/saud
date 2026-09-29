import { getTranslations } from "next-intl/server";
import { AlertTriangle, FileSearch } from "lucide-react";
import { getAnalysisJob, listRequirements, matrixCounts } from "@/server/services/analysis";
import { Card } from "@/components/ui";
import { loadTender, orNotFound } from "../load";
import { Stat } from "../stat";
import { Matrix } from "./matrix";

export default async function CompliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, ctx } = await loadTender(id);
  const t = await getTranslations("matrix");
  const job = await getAnalysisJob(ctx, id);
  if (job?.status !== "succeeded") {
    return (
      <Card className="flex flex-col items-center px-6 py-14 text-center">
        <FileSearch className="mb-3 h-8 w-8 text-muted" />
        <p className="max-w-md text-sm text-muted">{t("pending")}</p>
      </Card>
    );
  }
  const rows = await orNotFound(listRequirements(ctx, id));
  const c = matrixCounts(rows);
  const failed = ((job.detail as { failedChunks?: { file: number; pages: string }[] }).failedChunks ?? []);

  return (
    <>
      {/* رأس المصفوفة: عدد غير الموثّق يظهر دائماً */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t("counts.total")} value={c.total} />
        <Stat label={t("counts.mandatory")} value={c.mandatory} />
        <Stat label={t("counts.disqualifying")} value={c.disqualifying} tone={c.disqualifying ? "danger" : undefined} />
        <Stat label={t("counts.needsReview")} value={c.needsReview} tone={c.needsReview ? "warn" : undefined} />
        <Stat label={t("counts.unverified")} value={c.unverified} tone={c.unverified ? "danger" : undefined} />
        <Stat label={t("counts.similar")} value={c.similarGroups} tone={c.similarGroups ? "warn" : undefined} />
      </div>

      {failed.length > 0 && (
        <div className="mb-5 flex gap-3 rounded-xl border border-warn/30 bg-warn-soft p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <div className="text-sm">
            <div className="font-semibold text-warn">{t("failedChunks", { count: failed.length })}</div>
            <p className="mt-1 text-ink-2">{t("failedChunksBody", { where: failed.map((f) => t("fileShort", { f: f.file, p: f.pages })).join("، ") })}</p>
          </div>
        </div>
      )}

      <Matrix tenderId={id} rows={rows} canEdit={session.role !== "reviewer"} />
    </>
  );
}
