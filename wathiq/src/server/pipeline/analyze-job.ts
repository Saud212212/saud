import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { withOrg, type OrgContext } from "../db/client";
import {
  aiRuns,
  chunks,
  documentPages,
  processingJobs,
  requirements,
  tenderFacts,
  tenderFiles,
  tenderItems,
  tenders,
} from "../db/schema";
import { decryptJson, encryptJson } from "../crypto/envelope";
import { aad } from "../crypto/aad";
import { getTenderKey } from "../crypto/keystore";
import { setProgress } from "../queue/queue";
import { env } from "../env";
import { audit } from "../services/audit";
import { decryptMeta, encryptMeta } from "../services/tenders";
import { loadPrompt, type LoadedPrompt } from "../ai/prompts";
import { aiConfig, taskSettings } from "../ai/config";
import { llmProvider } from "../ai/provider";
import { callJson } from "../ai/llm-json";
import { ExtractOutput, SUMMARY_FIELDS, type Source, type SummaryField } from "../analysis/schema";
import { PageIndex, verifyQuote, type PageForVerify, type VerificationResult } from "../analysis/verify";
import { mergeRequirements, type RequirementCandidate } from "../analysis/merge";
import { normalizeText } from "../analysis/normalize";
import { JobTargetGoneError } from "./extract-job";
import type { PageContent } from "./types";
import type { ChunkSpan } from "./chunk";

/**
 * مهمة التحليل (المرحلة 2): لكل مقطع استدعاء مستقل للنموذج ← تحقق برمجي من كل اقتباس
 * ← دمج في الكود (حذف المكرر التام فقط) ← معرّفات نهائية ← حفظ مشفّر.
 * التقدم: prepare 0–3 · analyze 3–85 · verify 85–95 · save 95–100
 */

interface ChunkCtx {
  id: string;
  tenderFileId: string;
  fileOrdinal: number;
  fileRole: string;
  ordinal: number;
  pageStart: number;
  pageEnd: number;
  text: string;
  spans: ChunkSpan[];
}

const ROLE_AR: Record<string, string> = { booklet: "كراسة الشروط والمواصفات", annex: "ملحق", boq: "جدول الكميات", other: "مستند مرفق" };

/** نص المقطع كما يُرسل للنموذج: علامات صفحات صريحة حتى يستشهد النموذج برقم الصفحة الصحيح. */
export function renderChunkForModel(c: ChunkCtx, pages: Map<number, PageForVerify & { ocr: boolean }>, fileCount: number, chunkCount: number) {
  const parts: string[] = [];
  for (const s of c.spans) {
    const p = pages.get(s.page);
    if (!p) continue;
    const marker = p.ocr ? `[صفحة ${s.page} — نص مستخرج بالتعرّف الضوئي وقد يحتوي أخطاء قراءة]` : `[صفحة ${s.page}]`;
    parts.push(`${marker}\n${p.text.slice(s.start, s.end)}`);
  }
  return [
    `المستند: ${ROLE_AR[c.fileRole] ?? "مستند"} (ملف ${c.fileOrdinal + 1} من ${fileCount})`,
    `المقطع ${c.ordinal + 1} من ${chunkCount} — الصفحات ${c.pageStart}${c.pageEnd !== c.pageStart ? `–${c.pageEnd}` : ""}`,
    "",
    "<نص_الكراسة>",
    parts.join("\n\n"),
    "</نص_الكراسة>",
  ].join("\n");
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, queue.length)) }, async () => {
    for (let it = queue.shift(); it !== undefined; it = queue.shift()) await fn(it);
  }));
}

const firstRectKey = (v: VerificationResult) => (v.rects[0] ? v.rects[0].b[1] * 10000 + (10000 - v.rects[0].b[2]) : 1e9);

interface FactCandidate {
  field: string;
  ordinal: number;
  value: Record<string, unknown>;
  valueKey: string;
  source: Source;
  chunk: ChunkCtx;
  verification: VerificationResult;
}

export async function runAnalyzeJob(jobId: string, orgId: string): Promise<void> {
  const ctx: OrgContext & { actorKind: "worker" } = { orgId, userId: null, actorKind: "worker" };
  const cfg = aiConfig();
  const settings = taskSettings("extract", cfg);
  const provider = llmProvider(cfg);

  const loaded = await withOrg(ctx, async (tx) => {
    const [job] = await tx.select().from(processingJobs).where(eq(processingJobs.id, jobId));
    if (!job) return null;
    const [tender] = await tx.select().from(tenders).where(eq(tenders.id, job.tenderId));
    if (!tender) return null;
    const tfs = await tx.select().from(tenderFiles).where(eq(tenderFiles.tenderId, tender.id)).orderBy(asc(tenderFiles.ordinal));
    const chunkRows = await tx.select().from(chunks).where(eq(chunks.tenderId, tender.id));
    const pageRows = await tx.select().from(documentPages).where(eq(documentPages.tenderId, tender.id));
    await tx
      .update(processingJobs)
      .set({ status: "running", stage: "prepare", progress: 1, startedAt: new Date(), error: null, attempts: job.attempts + 1, updatedAt: new Date() })
      .where(eq(processingJobs.id, jobId));
    await tx.update(tenders).set({ status: "analyzing", updatedAt: new Date() }).where(eq(tenders.id, tender.id));
    return { tender, tfs, chunkRows, pageRows };
  });
  if (!loaded) throw new JobTargetGoneError(`analyze job ${jobId} target not found in org ${orgId}`);
  const { tender, tfs, chunkRows, pageRows } = loaded;
  const dek = await getTenderKey(orgId, tender.id);
  const prompt: LoadedPrompt = await loadPrompt("extract");

  // ── فك الصفحات والمقاطع في الذاكرة فقط ──
  const fileInfo = new Map(tfs.map((f) => [f.id, f]));
  const pagesByFile = new Map<string, Map<number, PageForVerify & { ocr: boolean }>>();
  for (const r of pageRows) {
    const c = decryptJson<PageContent>(dek, r.contentEnc, aad.page(r.tenderFileId, r.pageNo));
    if (!pagesByFile.has(r.tenderFileId)) pagesByFile.set(r.tenderFileId, new Map());
    pagesByFile.get(r.tenderFileId)!.set(r.pageNo, { text: c.text, words: c.words, lowConfidence: r.lowConfidence, ocr: r.source === "ocr" });
  }
  const indexes = new Map([...pagesByFile].map(([id, m]) => [id, new PageIndex(m)]));
  const chunkList: ChunkCtx[] = chunkRows
    .map((r) => {
      const c = decryptJson<{ text: string; spans: ChunkSpan[] }>(dek, r.contentEnc, aad.chunk(r.tenderFileId, r.ordinal));
      const f = fileInfo.get(r.tenderFileId)!;
      return { id: r.id, tenderFileId: r.tenderFileId, fileOrdinal: f.ordinal, fileRole: f.role, ordinal: r.ordinal, pageStart: r.pageStart, pageEnd: r.pageEnd, text: c.text, spans: c.spans };
    })
    .sort((a, b) => a.fileOrdinal - b.fileOrdinal || a.ordinal - b.ordinal);
  const chunksPerFile = new Map<string, number>();
  for (const c of chunkList) chunksPerFile.set(c.tenderFileId, (chunksPerFile.get(c.tenderFileId) ?? 0) + 1);

  const detail = { chunksTotal: chunkList.length, chunksDone: 0, chunksFailed: 0, failedChunks: [] as { file: number; ordinal: number; pages: string; error: string }[], tokens: { input: 0, output: 0, cacheRead: 0 } };
  let lastReport = 0;
  let current = 0;
  const report = async (stage: string, progress: number, force = false) => {
    current = Math.max(current, progress);
    if (!force && Date.now() - lastReport < 700) return;
    lastReport = Date.now();
    await setProgress(ctx, jobId, { stage, progress: current, detail: { ...detail } });
  };
  await report("prepare", 3, true);

  // ── استدعاء النموذج لكل مقطع ──
  const outputs: { chunk: ChunkCtx; out: ExtractOutput }[] = [];
  await pool(chunkList, cfg.AI_CONCURRENCY, async (chunk) => {
    const user = renderChunkForModel(chunk, pagesByFile.get(chunk.tenderFileId) ?? new Map(), tfs.length, chunksPerFile.get(chunk.tenderFileId) ?? 1);
    const runId = randomUUID();
    let status = "error";
    let error: string | null = null;
    let last = null as Awaited<ReturnType<typeof callJson>>["attempts"][number]["response"];
    let attempts = 1;
    try {
      const res = await callJson(provider, { ...settings, system: prompt.text, messages: [{ role: "user", content: user }] }, ExtractOutput);
      attempts = res.attempts.length;
      last = res.attempts.at(-1)?.response ?? null;
      for (const a of res.attempts) {
        if (!a.response) continue;
        detail.tokens.input += a.response.usage.input;
        detail.tokens.output += a.response.usage.output;
        detail.tokens.cacheRead += a.response.usage.cacheRead;
      }
      if (res.ok) {
        status = "ok";
        outputs.push({ chunk, out: res.data! });
      } else {
        status = "invalid";
        error = res.attempts.at(-1)?.error ?? "invalid output";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    if (status !== "ok") {
      detail.chunksFailed++;
      detail.failedChunks.push({ file: chunk.fileOrdinal + 1, ordinal: chunk.ordinal + 1, pages: `${chunk.pageStart}-${chunk.pageEnd}`, error: (error ?? "").slice(0, 200) });
    }
    await withOrg(ctx, (tx) =>
      tx.insert(aiRuns).values({
        id: runId,
        orgId,
        tenderId: tender.id,
        jobId,
        chunkId: chunk.id,
        task: "extract",
        promptVersion: prompt.version,
        rulesVersion: prompt.rulesVersion,
        promptSha256: prompt.sha256,
        provider: provider.name,
        modelRequested: settings.model,
        modelServed: last?.model ?? null,
        effort: settings.effort,
        inputTokens: last?.usage.input ?? 0,
        outputTokens: last?.usage.output ?? 0,
        cacheReadTokens: last?.usage.cacheRead ?? 0,
        cacheWriteTokens: last?.usage.cacheWrite ?? 0,
        latencyMs: last?.latencyMs ?? 0,
        attempts,
        status,
        error: error?.slice(0, 1000) ?? null,
        outputEnc: last ? encryptJson(dek, { text: last.text }, aad.aiRun(runId)) : null,
      }),
    );
    detail.chunksDone++;
    await report("analyze", 3 + (82 * detail.chunksDone) / Math.max(1, chunkList.length));
  });

  if (chunkList.length > 0 && outputs.length === 0) {
    throw new Error(`analysis failed for all ${chunkList.length} chunks: ${detail.failedChunks[0]?.error ?? ""}`);
  }
  await report("verify", 85, true);

  // ── التحقق من كل اقتباس ──
  const verify = (chunk: ChunkCtx, src: Source, claims: (string | null | undefined)[] = []) =>
    verifyQuote({ quote: src.quote, page: src.page, claims }, indexes.get(chunk.tenderFileId) ?? new PageIndex(new Map()), {
      ocrNumbers: env().OCR_NUMBERS_REVIEW,
    });

  const reqCandidates: RequirementCandidate[] = [];
  const facts: FactCandidate[] = [];
  const items: { kind: "staffing" | "deliverable" | "offer_content" | "risk" | "verify_note"; content: Record<string, unknown>; source: Source | null; chunk: ChunkCtx; verification: VerificationResult | null }[] = [];

  for (const { chunk, out } of outputs) {
    for (const r of out.requirements) {
      if (!r.text) continue;
      reqCandidates.push({
        tmpId: randomUUID(),
        chunkId: chunk.id,
        localId: r.local_id,
        tenderFileId: chunk.tenderFileId,
        fileOrdinal: chunk.fileOrdinal,
        category: r.category.value,
        categoryRaw: r.category.raw,
        text: r.text,
        obligation: r.obligation,
        disqualifying: r.disqualifying_if_missing,
        evidenceRequired: r.evidence_required,
        clause: r.source.clause,
        quote: r.source.quote,
        statedPage: r.source.page,
        verification: verify(chunk, r.source, [r.text]),
        sortKey: 0,
      });
    }

    const ts = out.tender_summary as Record<string, unknown> & { dates?: Record<string, string | null>; evaluation?: Record<string, unknown>; local_content?: Record<string, unknown> };
    const get = (f: SummaryField): string | null => {
      const [a, b] = f.split(".");
      const v = b ? (ts[a] as Record<string, unknown> | undefined)?.[b] : ts[a];
      return typeof v === "string" && v.trim() ? v : null;
    };
    const srcFor = (f: SummaryField): Source | null => {
      const leaf = f.split(".").at(-1)!;
      const s = out.field_sources[f] ?? out.field_sources[leaf] ?? out.field_sources[`tender_summary.${f}`];
      if (s?.quote) return s;
      if (f.startsWith("local_content.")) {
        const lc = ts.local_content?.source as Source | undefined;
        if (lc?.quote) return lc;
      }
      return null;
    };
    for (const f of SUMMARY_FIELDS) {
      const value = get(f);
      if (!value) continue;
      const src = srcFor(f) ?? { page: null, clause: null, quote: null };
      const extra = f.startsWith("dates.") && ts.dates?.calendar ? { calendar: ts.dates.calendar } : {};
      facts.push({ field: f, ordinal: 0, value: { value, ...extra }, valueKey: normalizeText(value), source: src, chunk, verification: verify(chunk, src, [value]) });
    }
    for (const c of (ts.evaluation?.criteria as { name: string | null; weight: string | null; sub_criteria: string[]; source: Source }[]) ?? []) {
      if (!c.name) continue;
      facts.push({
        field: "evaluation.criteria",
        ordinal: 0,
        value: { name: c.name, weight: c.weight, sub_criteria: c.sub_criteria },
        valueKey: `${normalizeText(c.name)}|${normalizeText(c.weight ?? "")}`,
        source: c.source,
        chunk,
        verification: verify(chunk, c.source, [c.weight]),
      });
    }
    const lc = ts.local_content as { mandatory_list_items?: string[]; source?: Source } | undefined;
    for (const it of lc?.mandatory_list_items ?? []) {
      const src = lc?.source ?? { page: null, clause: null, quote: null };
      facts.push({ field: "local_content.mandatory_list_items", ordinal: 0, value: { value: it }, valueKey: normalizeText(it), source: src, chunk, verification: verify(chunk, src) });
    }

    const add = (kind: (typeof items)[number]["kind"], list: ({ source: Source } & Record<string, unknown>)[], claimKeys: string[]) => {
      for (const { source, ...content } of list) {
        items.push({ kind, content, source, chunk, verification: verify(chunk, source, claimKeys.map((k) => content[k] as string | null)) });
      }
    };
    add("staffing", out.staffing_requirements, ["count", "min_experience_years"]);
    add("deliverable", out.deliverables, ["deadline"]);
    add("offer_content", out.technical_offer_required_contents, []);
    // المخاطر قد تنقل رقماً مشوّهاً عمداً (القاعدة 5) فلا نفحص أرقامها مقابل المصدر
    add("risk", out.risks_and_ambiguities, []);
    for (const note of out.verify_notes) {
      if (items.some((i) => i.kind === "verify_note" && normalizeText(String(i.content.note)) === normalizeText(note))) continue;
      items.push({ kind: "verify_note", content: { note }, source: null, chunk, verification: null });
    }
  }

  for (const c of reqCandidates) c.sortKey = firstRectKey(c.verification);
  const merged = mergeRequirements(reqCandidates);

  // ── الملخص: مرشح أساسي لكل حقل + كشف التعارض ──
  const byField = new Map<string, FactCandidate[]>();
  for (const f of facts) byField.set(f.field, [...(byField.get(f.field) ?? []), f]);
  const RANK = { verified: 0, verified_corrected_page: 1, needs_review: 2, unverified: 3 } as const;
  const factRows: (FactCandidate & { isPrimary: boolean; conflict: boolean })[] = [];
  for (const [field, list] of byField) {
    // إزالة المكرر التام (نفس القيمة من نفس الموضع)
    const unique: FactCandidate[] = [];
    for (const f of list) {
      const page = f.verification.matchedPage ?? f.source.page;
      if (!unique.some((u) => u.valueKey === f.valueKey && u.chunk.tenderFileId === f.chunk.tenderFileId && (u.verification.matchedPage ?? u.source.page) === page)) unique.push(f);
    }
    unique.sort((a, b) => RANK[a.verification.status] - RANK[b.verification.status] || a.chunk.fileOrdinal - b.chunk.fileOrdinal || (a.source.page ?? 0) - (b.source.page ?? 0));
    const multi = field === "evaluation.criteria" || field === "local_content.mandatory_list_items";
    const shownValues = new Set(unique.filter((u) => u.verification.status !== "unverified").map((u) => u.valueKey));
    const conflict = !multi && shownValues.size > 1;
    if (multi) {
      // لكل عنصر مميّز (بالقيمة) صف أساسي واحد
      const seen = new Set<string>();
      unique.forEach((u, i) => {
        const primary = !seen.has(u.valueKey) && u.verification.status !== "unverified";
        if (primary) seen.add(u.valueKey);
        factRows.push({ ...u, ordinal: i, isPrimary: primary, conflict: false });
      });
    } else {
      unique.forEach((u, i) => factRows.push({ ...u, ordinal: i, isPrimary: i === 0 && u.verification.status !== "unverified", conflict }));
    }
  }

  await report("save", 95, true);

  // ── الحفظ (إعادة التشغيل تستبدل التحليل السابق بالكامل) ──
  const stats = {
    requirementsShown: merged.requirements.filter((r) => r.verification.status !== "unverified").length,
    unverified: merged.requirements.filter((r) => r.verification.status === "unverified").length,
    needsReview: merged.requirements.filter((r) => r.verification.status === "needs_review").length,
    mandatory: merged.requirements.filter((r) => r.verification.status !== "unverified" && r.obligation === "mandatory").length,
    disqualifying: merged.requirements.filter((r) => r.verification.status !== "unverified" && r.disqualifying).length,
    similarGroups: merged.similarGroups,
    exactDuplicatesRemoved: merged.exactDuplicatesRemoved,
    facts: factRows.filter((f) => f.isPrimary).length,
  };

  await withOrg(ctx, async (tx) => {
    await tx.delete(requirements).where(eq(requirements.tenderId, tender.id));
    await tx.delete(tenderFacts).where(eq(tenderFacts.tenderId, tender.id));
    await tx.delete(tenderItems).where(eq(tenderItems.tenderId, tender.id));

    const reqRows = merged.requirements.map((r, i) => {
      const id = randomUUID();
      return {
        id,
        orgId,
        tenderId: tender.id,
        code: r.code,
        ordinal: i,
        category: r.category,
        obligation: r.obligation,
        disqualifying: r.disqualifying,
        verification: r.verification.status,
        reviewReasons: r.verification.reasons,
        similarity: r.verification.similarity,
        tenderFileId: r.tenderFileId,
        statedPage: r.statedPage,
        matchedPage: r.verification.matchedPage,
        similarGroupId: r.similarGroupId,
        chunkId: r.chunkId,
        contentEnc: encryptJson(
          dek,
          {
            text: r.text,
            evidenceRequired: r.evidenceRequired,
            clause: r.clause,
            quote: r.quote,
            matchedText: r.verification.matchedText,
            rects: r.verification.rects,
            categoryRaw: r.categoryRaw,
            localId: r.localId,
            mergedLocalIds: r.mergedLocalIds,
          },
          aad.requirement(id),
        ),
      };
    });
    for (let k = 0; k < reqRows.length; k += 100) await tx.insert(requirements).values(reqRows.slice(k, k + 100));

    const fRows = factRows.map((f) => {
      const id = randomUUID();
      return {
        id,
        orgId,
        tenderId: tender.id,
        field: f.field,
        ordinal: f.ordinal,
        isPrimary: f.isPrimary,
        conflict: f.conflict,
        tenderFileId: f.chunk.tenderFileId,
        statedPage: f.source.page,
        matchedPage: f.verification.matchedPage,
        verification: f.verification.status,
        reviewReasons: f.verification.reasons,
        similarity: f.verification.similarity,
        chunkId: f.chunk.id,
        valueEnc: encryptJson(dek, f.value, aad.factValue(id)),
        sourceEnc: encryptJson(dek, { clause: f.source.clause, quote: f.source.quote, matchedText: f.verification.matchedText, rects: f.verification.rects }, aad.factSource(id)),
      };
    });
    for (let k = 0; k < fRows.length; k += 100) await tx.insert(tenderFacts).values(fRows.slice(k, k + 100));

    const iRows = items.map((it, i) => {
      const id = randomUUID();
      const v = it.verification;
      return {
        id,
        orgId,
        tenderId: tender.id,
        kind: it.kind,
        ordinal: i,
        tenderFileId: it.chunk.tenderFileId,
        statedPage: it.source?.page ?? null,
        matchedPage: v?.matchedPage ?? null,
        verification: v?.status ?? ("unverified" as const),
        reviewReasons: v?.reasons ?? [],
        chunkId: it.chunk.id,
        contentEnc: encryptJson(dek, { ...it.content, clause: it.source?.clause ?? null, quote: it.source?.quote ?? null, rects: v?.rects ?? [] }, aad.item(id)),
      };
    });
    for (let k = 0; k < iRows.length; k += 100) await tx.insert(tenderItems).values(iRows.slice(k, k + 100));

    // استكمال الجهة/الرقم في بيانات المنافسة (المشفّرة) إن تركها المستخدم فارغة، من قيمة موثّقة فقط
    const [row] = await tx.select({ metaEnc: tenders.metaEnc }).from(tenders).where(eq(tenders.id, tender.id));
    const meta = decryptMeta(dek, tender.id, row.metaEnc);
    const confirmed = (field: string) =>
      factRows.find((f) => f.field === field && f.isPrimary && !f.conflict && (f.verification.status === "verified" || f.verification.status === "verified_corrected_page"));
    const agency = confirmed("entity");
    const number = confirmed("tender_number");
    if ((!meta.agency && agency) || (!meta.referenceNumber && number)) {
      await tx
        .update(tenders)
        .set({
          metaEnc: encryptMeta(dek, tender.id, {
            ...meta,
            agency: meta.agency ?? (agency?.value.value as string) ?? null,
            referenceNumber: meta.referenceNumber ?? (number?.value.value as string) ?? null,
          }),
        })
        .where(eq(tenders.id, tender.id));
    }

    await tx
      .update(processingJobs)
      .set({ status: "succeeded", stage: "done", progress: 100, detail: { ...detail, stats }, finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(processingJobs.id, jobId));
    await tx.update(tenders).set({ status: "ready", updatedAt: new Date() }).where(eq(tenders.id, tender.id));
    await audit(tx, ctx, "tender.analysis_completed", "tender", tender.id, {
      ...stats,
      chunks: detail.chunksTotal,
      chunksFailed: detail.chunksFailed,
      prompt: { version: prompt.version, rulesVersion: prompt.rulesVersion, sha256: prompt.sha256 },
      model: settings.model,
    });
  });
}
