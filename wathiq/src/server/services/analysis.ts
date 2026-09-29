import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { withOrg, type OrgContext, type Tx } from "../db/client";
import { files, memberships, processingJobs, requirements, tenderFacts, tenderFiles, tenderItems, tenders } from "../db/schema";
import { decryptBytes, decryptJson } from "../crypto/envelope";
import { aad } from "../crypto/aad";
import { getTenderKey } from "../crypto/keystore";
import { enqueueJob } from "../queue/queue";
import { audit, type RequestMeta } from "./audit";
import { forbidden, invalid, notFound } from "../errors";
import type { HighlightRect, ReviewReason, VerificationStatus } from "../analysis/verify";

async function requireRole(tx: Tx, ctx: OrgContext, allowed: ("owner" | "editor" | "reviewer")[]) {
  if (!ctx.userId) throw forbidden("user context required");
  const [m] = await tx
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, ctx.userId)));
  if (!m || !allowed.includes(m.role)) throw forbidden(`requires role: ${allowed.join("/")}`);
}

async function assertTender(tx: Tx, tenderId: string) {
  const [t] = await tx.select({ id: tenders.id }).from(tenders).where(eq(tenders.id, tenderId));
  if (!t) throw notFound("tender");
}

async function fileNames(tx: Tx, dek: Buffer, tenderId: string) {
  const rows = await tx
    .select({ id: tenderFiles.id, ordinal: tenderFiles.ordinal, fileId: files.id, nameEnc: files.nameEnc })
    .from(tenderFiles)
    .innerJoin(files, eq(files.id, tenderFiles.fileId))
    .where(eq(tenderFiles.tenderId, tenderId));
  return new Map(rows.map((r) => [r.id, { ordinal: r.ordinal, name: decryptBytes(dek, r.nameEnc, aad.fileName(r.fileId)).toString("utf8") }]));
}

export interface SourceRef {
  tenderFileId: string | null;
  fileName: string | null;
  statedPage: number | null;
  matchedPage: number | null;
  clause: string | null;
  quote: string | null;
  matchedText: string | null;
  rects: HighlightRect[];
  verification: VerificationStatus;
  reasons: ReviewReason[];
  similarity: number | null;
}

// ─── الملخص ─────────────────────────────────────────────────────────────────

export interface FactView {
  id: string;
  field: string;
  isPrimary: boolean;
  conflict: boolean;
  value: Record<string, unknown>;
  source: SourceRef;
}

export async function getSummary(ctx: OrgContext, tenderId: string) {
  return withOrg(ctx, async (tx) => {
    await assertTender(tx, tenderId);
    const dek = await getTenderKey(ctx.orgId, tenderId);
    const names = await fileNames(tx, dek, tenderId);
    const rows = await tx.select().from(tenderFacts).where(eq(tenderFacts.tenderId, tenderId)).orderBy(asc(tenderFacts.field), asc(tenderFacts.ordinal));
    const facts: FactView[] = rows.map((r) => {
      const src = decryptJson<{ clause: string | null; quote: string | null; matchedText: string | null; rects: HighlightRect[] }>(dek, r.sourceEnc, aad.factSource(r.id));
      return {
        id: r.id,
        field: r.field,
        isPrimary: r.isPrimary,
        conflict: r.conflict,
        value: decryptJson(dek, r.valueEnc, aad.factValue(r.id)),
        source: {
          tenderFileId: r.tenderFileId,
          fileName: r.tenderFileId ? names.get(r.tenderFileId)?.name ?? null : null,
          statedPage: r.statedPage,
          matchedPage: r.matchedPage,
          verification: r.verification,
          reasons: r.reviewReasons as ReviewReason[],
          similarity: r.similarity,
          ...src,
        },
      };
    });
    const byField = new Map<string, FactView[]>();
    for (const f of facts) byField.set(f.field, [...(byField.get(f.field) ?? []), f]);
    return byField;
  });
}

export async function getFact(ctx: OrgContext, tenderId: string, factId: string) {
  const all = await getSummary(ctx, tenderId);
  for (const list of all.values()) {
    const f = list.find((x) => x.id === factId);
    if (f) return f;
  }
  throw notFound("fact");
}

// ─── المتطلبات ──────────────────────────────────────────────────────────────

export interface RequirementView {
  id: string;
  code: string;
  ordinal: number;
  category: string | null;
  categoryRaw: string | null;
  obligation: "mandatory" | "preferred" | "informational" | null;
  disqualifying: boolean;
  text: string;
  evidenceRequired: string | null;
  status: "available" | "missing" | "needs_review";
  similarGroupId: string | null;
  mergeDecision: string | null;
  mergedLocalIds: string[];
  source: SourceRef;
}

export async function listRequirements(ctx: OrgContext, tenderId: string) {
  return withOrg(ctx, async (tx) => {
    await assertTender(tx, tenderId);
    const dek = await getTenderKey(ctx.orgId, tenderId);
    const names = await fileNames(tx, dek, tenderId);
    const rows = await tx.select().from(requirements).where(eq(requirements.tenderId, tenderId)).orderBy(asc(requirements.ordinal));
    return rows.map<RequirementView>((r) => {
      const c = decryptJson<{
        text: string;
        evidenceRequired: string | null;
        clause: string | null;
        quote: string | null;
        matchedText: string | null;
        rects: HighlightRect[];
        categoryRaw: string | null;
        mergedLocalIds: string[];
      }>(dek, r.contentEnc, aad.requirement(r.id));
      return {
        id: r.id,
        code: r.code,
        ordinal: r.ordinal,
        category: r.category,
        categoryRaw: c.categoryRaw,
        obligation: r.obligation,
        disqualifying: r.disqualifying,
        text: c.text,
        evidenceRequired: c.evidenceRequired,
        status: r.status,
        similarGroupId: r.mergeDecision ? null : r.similarGroupId,
        mergeDecision: r.mergeDecision,
        mergedLocalIds: c.mergedLocalIds ?? [],
        source: {
          tenderFileId: r.tenderFileId,
          fileName: r.tenderFileId ? names.get(r.tenderFileId)?.name ?? null : null,
          statedPage: r.statedPage,
          matchedPage: r.matchedPage,
          clause: c.clause,
          quote: c.quote,
          matchedText: c.matchedText,
          rects: c.rects,
          verification: r.verification,
          reasons: r.reviewReasons as ReviewReason[],
          similarity: r.similarity,
        },
      };
    });
  });
}

/** أعداد رأس المصفوفة. عدد غير الموثّق يظهر دائماً. */
export function matrixCounts(rows: RequirementView[]) {
  const shown = rows.filter((r) => r.source.verification !== "unverified");
  return {
    total: shown.length,
    mandatory: shown.filter((r) => r.obligation === "mandatory").length,
    disqualifying: shown.filter((r) => r.disqualifying).length,
    verified: shown.filter((r) => r.source.verification === "verified" || r.source.verification === "verified_corrected_page").length,
    needsReview: shown.filter((r) => r.source.verification === "needs_review").length,
    unverified: rows.length - shown.length,
    similarGroups: new Set(shown.map((r) => r.similarGroupId).filter(Boolean)).size,
  };
}

export async function getRequirement(ctx: OrgContext, tenderId: string, requirementId: string) {
  const r = (await listRequirements(ctx, tenderId)).find((x) => x.id === requirementId);
  if (!r) throw notFound("requirement");
  return r;
}

export async function listItems(ctx: OrgContext, tenderId: string) {
  return withOrg(ctx, async (tx) => {
    await assertTender(tx, tenderId);
    const dek = await getTenderKey(ctx.orgId, tenderId);
    const rows = await tx.select().from(tenderItems).where(eq(tenderItems.tenderId, tenderId)).orderBy(asc(tenderItems.kind), asc(tenderItems.ordinal));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      verification: r.verification,
      reasons: r.reviewReasons as ReviewReason[],
      tenderFileId: r.tenderFileId,
      page: r.matchedPage ?? r.statedPage,
      content: decryptJson<Record<string, unknown>>(dek, r.contentEnc, aad.item(r.id)),
    }));
  });
}

// ─── مراجعة الدمج (قرار المستخدم، لا حذف صامت) ─────────────────────────────

export type MergeAction = { action: "keep_all" } | { action: "merge"; keepId: string };

export async function resolveSimilarGroup(ctx: OrgContext, tenderId: string, groupId: string, decision: MergeAction, req?: RequestMeta) {
  return withOrg(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "editor"]);
    await assertTender(tx, tenderId);
    const members = await tx
      .select({ id: requirements.id, code: requirements.code })
      .from(requirements)
      .where(and(eq(requirements.tenderId, tenderId), eq(requirements.similarGroupId, groupId)));
    if (members.length < 2) throw notFound("similar group");
    if (decision.action === "keep_all") {
      await tx.update(requirements).set({ mergeDecision: "kept_separate", updatedAt: new Date() }).where(inArray(requirements.id, members.map((m) => m.id)));
      await audit(tx, ctx, "requirements.kept_separate", "tender", tenderId, { codes: members.map((m) => m.code) }, req);
      return { kept: members.length, removed: 0 };
    }
    const keep = members.find((m) => m.id === decision.keepId);
    if (!keep) throw invalid("keepId is not in this group");
    const removed = members.filter((m) => m.id !== keep.id);
    await tx.delete(requirements).where(inArray(requirements.id, removed.map((m) => m.id)));
    await tx.update(requirements).set({ mergeDecision: `merged:${removed.map((m) => m.code).join(",")}`, updatedAt: new Date() }).where(eq(requirements.id, keep.id));
    await audit(tx, ctx, "requirements.merged", "tender", tenderId, { kept: keep.code, removed: removed.map((m) => m.code) }, req);
    return { kept: 1, removed: removed.length };
  });
}

// ─── حالة التحليل وإعادة تشغيله ─────────────────────────────────────────────

export async function getAnalysisJob(ctx: OrgContext, tenderId: string) {
  return withOrg(ctx, async (tx) => {
    const [job] = await tx
      .select()
      .from(processingJobs)
      .where(and(eq(processingJobs.tenderId, tenderId), eq(processingJobs.kind, "analyze")))
      .orderBy(desc(processingJobs.createdAt))
      .limit(1);
    return job ?? null;
  });
}

export async function requestAnalysis(ctx: OrgContext, tenderId: string, req?: RequestMeta) {
  return withOrg(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "editor"]);
    const [t] = await tx.select({ status: tenders.status }).from(tenders).where(eq(tenders.id, tenderId));
    if (!t) throw notFound("tender");
    if (t.status !== "ready") throw invalid(`tender is ${t.status}; analysis can be re-run only when ready`);
    await tx.update(tenders).set({ status: "analyzing", updatedAt: new Date() }).where(eq(tenders.id, tenderId));
    const jobId = await enqueueJob(tx, ctx.orgId, tenderId, "analyze");
    await audit(tx, ctx, "tender.analysis_requested", "tender", tenderId, {}, req);
    return jobId;
  });
}
