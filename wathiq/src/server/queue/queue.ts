import { and, eq, sql } from "drizzle-orm";
import { withOrg, withQueue, type OrgContext, type Tx } from "../db/client";
import { processingJobs } from "../db/schema";

/**
 * طابور بسيط فوق Postgres (بدون Redis):
 *  - processing_jobs (تحت RLS): حالة المهمة كما يراها المستخدم.
 *  - job_queue (بلا RLS، معرّفات فقط): المطالبة بـ FOR UPDATE SKIP LOCKED.
 * بعد المطالبة يعالج العامل المهمة داخل withOrg(org_id) فتسري عليه RLS كاملة.
 */

export const MAX_ATTEMPTS = 3;
const STALE_LOCK_MINUTES = 15;

export async function enqueueJob(tx: Tx, orgId: string, tenderId: string, kind: "extract" | "analyze") {
  const [job] = await tx.insert(processingJobs).values({ orgId, tenderId, kind }).returning({ id: processingJobs.id });
  await tx.execute(sql`insert into job_queue (job_id, org_id) values (${job.id}, ${orgId})`);
  await tx.execute(sql`select pg_notify('wathiq_jobs', ${job.id})`);
  return job.id;
}

export interface ClaimedJob {
  jobId: string;
  orgId: string;
  attempts: number;
}

export async function claimJob(workerId: string): Promise<ClaimedJob | null> {
  return withQueue(async (c) => {
    const r = await c.query<{ job_id: string; org_id: string; attempts: number }>(
      `update job_queue q set locked_at = now(), locked_by = $1, attempts = q.attempts + 1
       where q.job_id = (
         select job_id from job_queue
         where (locked_at is null and run_after <= now())
            or locked_at < now() - make_interval(mins => $2)
         order by created_at
         for update skip locked
         limit 1)
       returning q.job_id, q.org_id, q.attempts`,
      [workerId, STALE_LOCK_MINUTES],
    );
    const row = r.rows[0];
    return row ? { jobId: row.job_id, orgId: row.org_id, attempts: row.attempts } : null;
  });
}

/** يُجدد القفل حتى لا تُعتبر مهمة طويلة (OCR لمئات الصفحات) متوقفة. */
export async function heartbeat(jobId: string) {
  await withQueue((c) => c.query("update job_queue set locked_at = now() where job_id = $1", [jobId]));
}

export async function completeJob(jobId: string) {
  await withQueue((c) => c.query("delete from job_queue where job_id = $1", [jobId]));
}

/** يعيد جدولة المهمة مع تأخير متزايد، أو يُسقطها نهائياً بعد MAX_ATTEMPTS. يُرجع true إذا انتهت المحاولات. */
export async function failJob(jobId: string, attempts: number): Promise<boolean> {
  if (attempts >= MAX_ATTEMPTS) {
    await completeJob(jobId);
    return true;
  }
  const delaySec = 30 * 2 ** (attempts - 1);
  await withQueue((c) =>
    c.query(
      "update job_queue set locked_at = null, locked_by = null, run_after = now() + make_interval(secs => $2) where job_id = $1",
      [jobId, delaySec],
    ),
  );
  return false;
}

export interface ProgressUpdate {
  stage: string;
  progress: number;
  detail?: Record<string, unknown>;
}

export async function setProgress(ctx: OrgContext, jobId: string, u: ProgressUpdate) {
  await withOrg(ctx, (tx) =>
    tx
      .update(processingJobs)
      .set({
        stage: u.stage,
        progress: Math.max(0, Math.min(100, Math.round(u.progress))),
        ...(u.detail ? { detail: u.detail } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(processingJobs.id, jobId), eq(processingJobs.orgId, ctx.orgId))),
  );
  await heartbeat(jobId);
}
