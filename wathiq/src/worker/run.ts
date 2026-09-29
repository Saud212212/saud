import { claimJob, completeJob, failJob } from "@/server/queue/queue";
import { eq } from "drizzle-orm";
import { JobTargetGoneError, markJobFailed, runExtractJob } from "@/server/pipeline/extract-job";
import { runAnalyzeJob } from "@/server/pipeline/analyze-job";
import { withOrg } from "@/server/db/client";
import { processingJobs } from "@/server/db/schema";
import { TenderKeyMissingError } from "@/server/crypto/keystore";

export type RunResult = "idle" | "succeeded" | "retrying" | "failed" | "gone";

/** يطالب بمهمة واحدة وينفذها. مفصول عن الحلقة لتسهيل الاختبار. */
export async function processOne(workerId: string, log = console): Promise<RunResult> {
  const claim = await claimJob(workerId);
  if (!claim) return "idle";
  const t0 = Date.now();
  try {
    // نوع المهمة يُقرأ تحت RLS: مدخل طابور لا يخص المؤسسة لا يجد مهمته
    const [job] = await withOrg({ orgId: claim.orgId }, (tx) =>
      tx.select({ kind: processingJobs.kind }).from(processingJobs).where(eq(processingJobs.id, claim.jobId)),
    );
    if (!job) throw new JobTargetGoneError(`job ${claim.jobId} not found in org ${claim.orgId}`);
    if (job.kind === "analyze") await runAnalyzeJob(claim.jobId, claim.orgId);
    else await runExtractJob(claim.jobId, claim.orgId);
    await completeJob(claim.jobId);
    log.info(`[worker] job ${claim.jobId} succeeded in ${Date.now() - t0}ms`);
    return "succeeded";
  } catch (err) {
    if (err instanceof JobTargetGoneError || err instanceof TenderKeyMissingError) {
      // المنافسة حُذفت نهائياً أثناء المعالجة، أو المعرّف لا يخص هذه المؤسسة
      await completeJob(claim.jobId);
      log.warn(`[worker] job ${claim.jobId} dropped: ${(err as Error).message}`);
      return "gone";
    }
    const message = err instanceof Error ? err.message : String(err);
    const final = await failJob(claim.jobId, claim.attempts);
    await markJobFailed(claim.jobId, claim.orgId, message, final).catch(() => {});
    log.error(`[worker] job ${claim.jobId} failed (attempt ${claim.attempts}${final ? ", final" : ""}): ${message}`);
    return final ? "failed" : "retrying";
  }
}
