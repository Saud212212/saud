import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, eq, asc } from "drizzle-orm";
import { withOrg, type OrgContext } from "../db/client";
import { chunks, documentPages, files, processingJobs, tenderFiles, tenders } from "../db/schema";
import { decryptBytes, encryptJson } from "../crypto/envelope";
import { aad } from "../crypto/aad";
import { getTenderKey } from "../crypto/keystore";
import { storage } from "../storage";
import { env } from "../env";
import { enqueueJob, setProgress } from "../queue/queue";
import { audit } from "../services/audit";
import { openPdf, analyzeTextLayer } from "./pdf-text";
import { classifyPage, detectBackgroundSignatures } from "./classify";
import { ocrPage } from "./ocr";
import { chunkPages } from "./chunk";
import type { ClassifiedPage, PageContent, PageKind, TextSource } from "./types";

/**
 * مهمة الاستخراج لمنافسة كاملة (كل ملفاتها). تعمل بالكامل داخل سياق المؤسسة (RLS).
 * مراحل التقدم: prepare 0–5 · text_layer 5–25 · ocr 25–92 · chunking 92–98 · done 100
 */

export class JobTargetGoneError extends Error {}

interface SavedPage {
  pageNo: number;
  kind: PageKind;
  source: TextSource;
  content: PageContent;
  ocrConfidence: number | null;
  lowConfidence: boolean;
  page: ClassifiedPage;
}

export async function runExtractJob(jobId: string, orgId: string): Promise<void> {
  const ctx: OrgContext & { actorKind: "worker" } = { orgId, userId: null, actorKind: "worker" };
  const e = env();

  const loaded = await withOrg(ctx, async (tx) => {
    const [job] = await tx.select().from(processingJobs).where(eq(processingJobs.id, jobId));
    if (!job) return null;
    const [tender] = await tx.select().from(tenders).where(eq(tenders.id, job.tenderId));
    if (!tender) return null;
    const tfs = await tx
      .select({ tf: tenderFiles, file: files })
      .from(tenderFiles)
      .innerJoin(files, eq(files.id, tenderFiles.fileId))
      .where(eq(tenderFiles.tenderId, tender.id))
      .orderBy(asc(tenderFiles.ordinal));
    await tx
      .update(processingJobs)
      .set({ status: "running", stage: "prepare", progress: 1, startedAt: new Date(), error: null, attempts: job.attempts + 1, updatedAt: new Date() })
      .where(eq(processingJobs.id, jobId));
    await tx.update(tenders).set({ status: "processing", updatedAt: new Date() }).where(eq(tenders.id, tender.id));
    return { job, tender, tfs };
  });
  // المهمة أو المنافسة غير موجودة في هذه المؤسسة (حُذفت، أو معرّف لا يخص المؤسسة)
  if (!loaded) throw new JobTargetGoneError(`job ${jobId} target not found in org ${orgId}`);
  const { tender, tfs } = loaded;
  const dek = await getTenderKey(orgId, tender.id);

  // ── التحضير: فك التشفير وفتح كل الملفات لمعرفة إجمالي الصفحات ──
  const docs = [];
  for (const { tf, file } of tfs) {
    const bytes = decryptBytes(dek, await storage().get(file.storageKey), aad.file(file.id));
    const pdf = await openPdf(new Uint8Array(bytes));
    docs.push({ tf, file, bytes, pdf });
  }
  const pagesTotal = docs.reduce((s, d) => s + d.pdf.numPages, 0);

  let lastReport = 0;
  let current = 0; // التقدم لا يتراجع أبداً
  const detail = { pagesTotal, textDone: 0, ocrTotal: 0, ocrDone: 0, pagesSaved: 0, lowConfidencePages: 0, currentFile: 0, filesTotal: docs.length };
  const report = async (stage: string, progress: number, force = false) => {
    current = Math.max(current, progress);
    progress = current;
    const now = Date.now();
    if (!force && now - lastReport < 700) return;
    lastReport = now;
    await setProgress(ctx, jobId, { stage, progress, detail: { ...detail } });
  };
  await report("prepare", 5, true);

  const stats = { text: 0, scanned: 0, hybrid: 0, broken_text: 0, blank: 0 } as Record<PageKind, number>;

  // ── المرور الأول: طبقة النص + التصنيف لكل الملفات ──
  const classified: ClassifiedPage[][] = [];
  for (const [i, d] of docs.entries()) {
    detail.currentFile = i + 1;
    const analyses = [];
    for (let n = 1; n <= d.pdf.numPages; n++) {
      analyses.push(await analyzeTextLayer(await d.pdf.getPage(n)));
      detail.textDone++;
      await report("text_layer", 5 + (20 * detail.textDone) / Math.max(1, pagesTotal));
    }
    const bg = detectBackgroundSignatures(analyses);
    const cls = analyses.map((a) => classifyPage(a, bg));
    classified.push(cls);
    detail.ocrTotal += cls.filter((c) => c.needsOcr).length;
  }
  await report("text_layer", 25, true);

  // ── لكل ملف: حفظ الصفحات النصية، OCR للبقية، ثم التقطيع ──
  for (const [i, d] of docs.entries()) {
    detail.currentFile = i + 1;
    const cls = classified[i];

    await withOrg(ctx, async (tx) => {
      // إعادة التشغيل آمنة: نحذف ناتج أي محاولة سابقة لهذا الملف
      await tx.delete(chunks).where(eq(chunks.tenderFileId, d.tf.id));
      await tx.delete(documentPages).where(eq(documentPages.tenderFileId, d.tf.id));
      await tx
        .update(tenderFiles)
        .set({ extractionStatus: "processing", pageCount: d.pdf.numPages, error: null })
        .where(eq(tenderFiles.id, d.tf.id));
    });

    const saved = new Map<number, SavedPage>();
    const persist = async (batch: SavedPage[]) => {
      if (!batch.length) return;
      await withOrg(ctx, (tx) =>
        tx.insert(documentPages).values(
          batch.map((s) => ({
            orgId,
            tenderId: tender.id,
            tenderFileId: d.tf.id,
            pageNo: s.pageNo,
            kind: s.kind,
            source: s.source,
            width: s.page.width,
            height: s.page.height,
            rotation: s.page.rotation,
            charCount: s.content.text.length,
            wordCount: s.content.words.length,
            imageCoverage: s.page.imageCoverage,
            ocrConfidence: s.ocrConfidence,
            lowConfidence: s.lowConfidence,
            contentEnc: encryptJson(dek, s.content, aad.page(d.tf.id, s.pageNo)),
          })),
        ),
      );
      for (const s of batch) {
        saved.set(s.pageNo, s);
        stats[s.kind]++;
        if (s.lowConfidence) detail.lowConfidencePages++;
      }
      detail.pagesSaved += batch.length;
    };

    // الصفحات التي لا تحتاج OCR تُحفظ مباشرة
    const direct = cls
      .filter((c) => !c.needsOcr)
      .map<SavedPage>((c) => ({
        pageNo: c.pageNo,
        kind: c.kind,
        source: c.kind === "blank" ? "none" : "text_layer",
        content: c.content,
        ocrConfidence: null,
        lowConfidence: false,
        page: c,
      }));
    for (let k = 0; k < direct.length; k += 25) await persist(direct.slice(k, k + 25));

    const needOcr = cls.filter((c) => c.needsOcr);
    if (needOcr.length) {
      // ملف مؤقت مفكوك التشفير لأداة الرسم فقط؛ صلاحيات 0600 داخل مجلد 0700، ويُحذف دائماً.
      const workDir = await mkdtemp(path.join(os.tmpdir(), "wathiq-ocr-"));
      try {
        const pdfPath = path.join(workDir, "doc.pdf");
        await writeFile(pdfPath, d.bytes, { mode: 0o600 });
        const queue = [...needOcr];
        const workerCount = Math.max(1, Math.min(e.OCR_CONCURRENCY, queue.length));
        await Promise.all(
          Array.from({ length: workerCount }, async () => {
            for (let c = queue.shift(); c; c = queue.shift()) {
              const r = await ocrPage(pdfPath, c.pageNo, workDir);
              let result: SavedPage;
              if (c.kind === "hybrid" && r.meaningfulChars <= c.meaningfulChars * 1.3) {
                // الصورة لم تُضف نصاً يُذكر → طبقة النص أدق
                result = { pageNo: c.pageNo, kind: "hybrid", source: "text_layer", content: c.content, ocrConfidence: r.confidence, lowConfidence: false, page: c };
              } else {
                const low = r.confidence === null || r.confidence < e.OCR_LOW_CONFIDENCE;
                result = { pageNo: c.pageNo, kind: c.kind, source: "ocr", content: r.content, ocrConfidence: r.confidence, lowConfidence: low, page: c };
              }
              await persist([result]);
              detail.ocrDone++;
              await report("ocr", 25 + (67 * detail.ocrDone) / Math.max(1, detail.ocrTotal));
            }
          }),
        );
      } finally {
        await rm(workDir, { recursive: true, force: true });
      }
    }

    // ── التقطيع ──
    // مرحلة "التقطيع" تُعرض عند آخر ملف فقط، حتى لا يبدو أن التحليل تجاوز OCR لملفات لم تُعالج بعد
    if (i === docs.length - 1) await report("chunking", 92, true);
    const ordered = [...saved.values()].sort((a, b) => a.pageNo - b.pageNo);
    const parts = chunkPages(ordered.map((s) => ({ pageNo: s.pageNo, text: s.content.text })));
    await withOrg(ctx, async (tx) => {
      for (let k = 0; k < parts.length; k += 50) {
        await tx.insert(chunks).values(
          parts.slice(k, k + 50).map((c) => ({
            orgId,
            tenderId: tender.id,
            tenderFileId: d.tf.id,
            ordinal: c.ordinal,
            pageStart: c.pageStart,
            pageEnd: c.pageEnd,
            sectionRef: c.sectionRef,
            charCount: c.text.length,
            tokenEstimate: c.tokenEstimate,
            contentEnc: encryptJson(dek, { heading: c.heading, text: c.text, spans: c.spans }, aad.chunk(d.tf.id, c.ordinal)),
          })),
        );
      }
      await tx.update(tenderFiles).set({ extractionStatus: "done" }).where(eq(tenderFiles.id, d.tf.id));
    });
    await d.pdf.loadingTask.destroy();
  }

  await withOrg(ctx, async (tx) => {
    await tx
      .update(processingJobs)
      .set({ status: "succeeded", stage: "done", progress: 100, detail: { ...detail, stats }, finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(processingJobs.id, jobId));
    // الاستخراج نجح ← التحليل (المرحلة 2) تلقائياً
    await tx.update(tenders).set({ status: "analyzing", updatedAt: new Date() }).where(and(eq(tenders.id, tender.id)));
    await enqueueJob(tx, orgId, tender.id, "analyze");
    await audit(tx, ctx, "tender.extraction_completed", "tender", tender.id, { pages: pagesTotal, stats, lowConfidencePages: detail.lowConfidencePages });
  });
}

/** يُسجّل فشل المهمة. final=true يعني انتهت المحاولات. */
export async function markJobFailed(jobId: string, orgId: string, message: string, final: boolean) {
  const ctx = { orgId, userId: null, actorKind: "worker" as const };
  await withOrg(ctx, async (tx) => {
    const [job] = await tx
      .update(processingJobs)
      .set({ status: final ? "failed" : "queued", stage: final ? "failed" : "retrying", error: message.slice(0, 1000), updatedAt: new Date(), ...(final ? { finishedAt: new Date() } : {}) })
      .where(eq(processingJobs.id, jobId))
      .returning({ tenderId: processingJobs.tenderId, kind: processingJobs.kind });
    if (job && final) {
      // فشل التحليل لا يُسقط المنافسة: نصوصها المستخرجة صالحة، ويمكن إعادة التحليل من الواجهة
      await tx
        .update(tenders)
        .set({ status: job.kind === "analyze" ? "ready" : "failed", updatedAt: new Date() })
        .where(eq(tenders.id, job.tenderId));
      await audit(tx, ctx, `tender.${job.kind === "analyze" ? "analysis" : "extraction"}_failed`, "tender", job.tenderId, { error: message.slice(0, 200) });
    }
  });
}
