import { randomUUID, createHash } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { withOrg, type OrgContext, type Tx } from "../db/client";
import { chunks, documentPages, files, memberships, processingJobs, tenderFiles, tenders } from "../db/schema";
import { decryptBytes, decryptJson, encryptBytes, encryptJson } from "../crypto/envelope";
import { aad } from "../crypto/aad";
import { createTenderKey, destroyTenderKey, getTenderKey } from "../crypto/keystore";
import { storage, tenderFileKey, tenderPrefix } from "../storage";
import { enqueueJob } from "../queue/queue";
import { env } from "../env";
import { audit, type RequestMeta } from "./audit";
import { forbidden, invalid, notFound } from "../errors";
import type { PageContent } from "../pipeline/types";
import type { ChunkSpan } from "../pipeline/chunk";

export type TenderFileRole = "booklet" | "annex" | "boq" | "other";

export interface UploadInput {
  title: string;
  referenceNumber?: string | null;
  agency?: string | null;
  files: { name: string; mime: string; data: Buffer; role: TenderFileRole }[];
}

const MAX_FILES = 10;

/** البيانات الوصفية للمنافسة — لا تُخزَّن إلا مشفّرة (tenders.meta_enc). */
export interface TenderMeta {
  title: string;
  referenceNumber: string | null;
  agency: string | null;
}

export const decryptMeta = (dek: Buffer, tenderId: string, enc: Buffer) => decryptJson<TenderMeta>(dek, enc, aad.tenderMeta(tenderId));
export const encryptMeta = (dek: Buffer, tenderId: string, meta: TenderMeta) => encryptJson(dek, meta, aad.tenderMeta(tenderId));
const decryptName = (dek: Buffer, fileId: string, enc: Buffer) => decryptBytes(dek, enc, aad.fileName(fileId)).toString("utf8");

async function requireRole(tx: Tx, ctx: OrgContext, allowed: ("owner" | "editor" | "reviewer")[]) {
  if (!ctx.userId) throw forbidden("user context required");
  const [m] = await tx
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, ctx.userId)));
  if (!m || !allowed.includes(m.role)) throw forbidden(`requires role: ${allowed.join("/")}`);
  return m.role;
}

export function validateUpload(input: UploadInput) {
  const title = input.title?.trim();
  if (!title || title.length > 300) throw invalid("title is required (max 300 chars)");
  if (!input.files.length) throw invalid("at least one PDF file is required");
  if (input.files.length > MAX_FILES) throw invalid(`at most ${MAX_FILES} files`);
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  for (const f of input.files) {
    if (f.data.length > maxBytes) throw invalid(`${f.name}: exceeds ${env().MAX_UPLOAD_MB}MB`);
    // نتحقق من التوقيع الفعلي وليس الامتداد أو نوع MIME المرسل
    if (f.data.subarray(0, 5).toString("latin1") !== "%PDF-") throw invalid(`${f.name}: not a PDF file`);
  }
  return title;
}

/**
 * إنشاء منافسة: مفتاح جديد ← تشفير الملفات ورفعها ← الصفوف + مهمة الاستخراج في معاملة واحدة.
 * أي فشل بعد إنشاء المفتاح يُنظّف الملفات ويتلف المفتاح.
 */
export async function createTender(ctx: OrgContext, input: UploadInput, req?: RequestMeta) {
  const title = validateUpload(input);
  const tenderId = randomUUID();
  await withOrg(ctx, (tx) => requireRole(tx, ctx, ["owner", "editor"]));

  const dek = await createTenderKey(ctx.orgId, tenderId);
  try {
    const stored: { fileId: string; key: string; f: UploadInput["files"][number]; i: number; sha: string }[] = [];
    for (const [i, f] of input.files.entries()) {
      const fileId = randomUUID();
      const key = tenderFileKey(ctx.orgId, tenderId, fileId);
      const enc = encryptBytes(dek, f.data, aad.file(fileId));
      await storage().put(key, enc);
      stored.push({ fileId, key, f, i, sha: createHash("sha256").update(enc).digest("hex") });
    }

    const jobId = await withOrg(ctx, async (tx) => {
      await tx.insert(tenders).values({
        id: tenderId,
        orgId: ctx.orgId,
        metaEnc: encryptMeta(dek, tenderId, {
          title,
          referenceNumber: input.referenceNumber?.trim().slice(0, 100) || null,
          agency: input.agency?.trim().slice(0, 300) || null,
        }),
        status: "processing",
        createdBy: ctx.userId ?? null,
      });
      for (const s of stored) {
        await tx.insert(files).values({
          id: s.fileId,
          orgId: ctx.orgId,
          tenderId,
          storageKey: s.key,
          nameEnc: encryptBytes(dek, Buffer.from(s.f.name.slice(0, 255), "utf8"), aad.fileName(s.fileId)),
          mime: "application/pdf",
          sizeBytes: s.f.data.length,
          ciphertextSha256: s.sha,
          uploadedBy: ctx.userId ?? null,
        });
        await tx.insert(tenderFiles).values({ orgId: ctx.orgId, tenderId, fileId: s.fileId, role: s.f.role, ordinal: s.i });
      }
      const id = await enqueueJob(tx, ctx.orgId, tenderId, "extract");
      await audit(tx, ctx, "tender.created", "tender", tenderId, { files: stored.length, bytes: input.files.reduce((a, f) => a + f.data.length, 0) }, req);
      return id;
    });
    return { tenderId, jobId };
  } catch (e) {
    await storage().deletePrefix(tenderPrefix(ctx.orgId, tenderId)).catch(() => {});
    await destroyTenderKey(ctx.orgId, tenderId).catch(() => {});
    throw e;
  }
}

/** كل صف يُفك بمفتاح منافسته (مخزّن مؤقتاً في الذاكرة لكل عملية). */
export async function listTenders(ctx: OrgContext) {
  const rows = await withOrg(ctx, (tx) =>
    tx
      .select({
        id: tenders.id,
        metaEnc: tenders.metaEnc,
        status: tenders.status,
        createdAt: tenders.createdAt,
        pages: sql<number>`(select count(*)::int from document_pages p where p.tender_id = ${tenders.id})`,
        files: sql<number>`(select count(*)::int from tender_files f where f.tender_id = ${tenders.id})`,
      })
      .from(tenders)
      .orderBy(desc(tenders.createdAt)),
  );
  return Promise.all(
    rows.map(async ({ metaEnc, ...r }) => {
      const dek = await getTenderKey(ctx.orgId, r.id);
      return { ...r, ...decryptMeta(dek, r.id, metaEnc) };
    }),
  );
}

export async function getTenderDetail(ctx: OrgContext, tenderId: string) {
  return withOrg(ctx, async (tx) => {
    const [row] = await tx.select().from(tenders).where(eq(tenders.id, tenderId));
    if (!row) throw notFound("tender");
    const dek = await getTenderKey(ctx.orgId, tenderId);
    const { metaEnc, ...rest } = row;
    const tender = { ...rest, ...decryptMeta(dek, tenderId, metaEnc) };
    const tfRows = await tx
      .select({
        id: tenderFiles.id,
        fileId: files.id,
        nameEnc: files.nameEnc,
        sizeBytes: files.sizeBytes,
        role: tenderFiles.role,
        pageCount: tenderFiles.pageCount,
        status: tenderFiles.extractionStatus,
      })
      .from(tenderFiles)
      .innerJoin(files, eq(files.id, tenderFiles.fileId))
      .where(eq(tenderFiles.tenderId, tenderId))
      .orderBy(asc(tenderFiles.ordinal));
    const tfs = tfRows.map(({ nameEnc, ...f }) => ({ ...f, name: decryptName(dek, f.fileId, nameEnc) }));
    const pages = await tx
      .select({
        tenderFileId: documentPages.tenderFileId,
        pageNo: documentPages.pageNo,
        kind: documentPages.kind,
        source: documentPages.source,
        charCount: documentPages.charCount,
        wordCount: documentPages.wordCount,
        imageCoverage: documentPages.imageCoverage,
        ocrConfidence: documentPages.ocrConfidence,
        lowConfidence: documentPages.lowConfidence,
      })
      .from(documentPages)
      .where(eq(documentPages.tenderId, tenderId))
      .orderBy(asc(documentPages.pageNo));
    const [job] = await tx
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.tenderId, tenderId))
      .orderBy(desc(processingJobs.createdAt))
      .limit(1);
    const [{ n: chunkCount }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(chunks)
      .where(eq(chunks.tenderId, tenderId));
    return { tender, files: tfs, pages, job: job ?? null, chunkCount };
  });
}

export async function getJobStatus(ctx: OrgContext, tenderId: string) {
  return withOrg(ctx, async (tx) => {
    const [tender] = await tx.select({ status: tenders.status }).from(tenders).where(eq(tenders.id, tenderId));
    if (!tender) return null;
    const [job] = await tx
      .select({
        status: processingJobs.status,
        stage: processingJobs.stage,
        progress: processingJobs.progress,
        detail: processingJobs.detail,
        error: processingJobs.error,
      })
      .from(processingJobs)
      .where(eq(processingJobs.tenderId, tenderId))
      .orderBy(desc(processingJobs.createdAt))
      .limit(1);
    return { tenderStatus: tender.status, job: job ?? null };
  });
}

export async function getPageContent(ctx: OrgContext, tenderId: string, tenderFileId: string, pageNo: number) {
  const row = await withOrg(ctx, async (tx) => {
    const [p] = await tx
      .select()
      .from(documentPages)
      .where(and(eq(documentPages.tenderId, tenderId), eq(documentPages.tenderFileId, tenderFileId), eq(documentPages.pageNo, pageNo)));
    return p;
  });
  if (!row) throw notFound("page");
  const dek = await getTenderKey(ctx.orgId, tenderId);
  const content = decryptJson<PageContent>(dek, row.contentEnc, aad.page(tenderFileId, pageNo));
  const { contentEnc: _omit, ...meta } = row;
  void _omit;
  return { ...meta, content };
}

export async function listChunks(ctx: OrgContext, tenderId: string) {
  const rows = await withOrg(ctx, async (tx) =>
    (
      await tx
        .select({ c: chunks })
        .from(chunks)
        .innerJoin(tenderFiles, eq(tenderFiles.id, chunks.tenderFileId))
        .where(eq(chunks.tenderId, tenderId))
        .orderBy(asc(tenderFiles.ordinal), asc(chunks.ordinal))
    ).map((r) => r.c),
  );
  if (!rows.length) return [];
  const dek = await getTenderKey(ctx.orgId, tenderId);
  return rows.map((r) => {
    const c = decryptJson<{ heading: string | null; text: string; spans: ChunkSpan[] }>(dek, r.contentEnc, aad.chunk(r.tenderFileId, r.ordinal));
    return {
      id: r.id,
      tenderFileId: r.tenderFileId,
      ordinal: r.ordinal,
      pageStart: r.pageStart,
      pageEnd: r.pageEnd,
      sectionRef: r.sectionRef,
      tokenEstimate: r.tokenEstimate,
      ...c,
    };
  });
}

/** يُرجع الملف الأصلي مفكوك التشفير (لعارض PDF)، ويُسجَّل الوصول في سجل التدقيق. */
export async function readTenderFile(ctx: OrgContext, tenderId: string, fileId: string, req?: RequestMeta) {
  const file = await withOrg(ctx, async (tx) => {
    const [f] = await tx.select().from(files).where(and(eq(files.id, fileId), eq(files.tenderId, tenderId)));
    if (f) await audit(tx, ctx, "file.viewed", "file", f.id, { tenderId }, req);
    return f;
  });
  if (!file) throw notFound("file");
  const dek = await getTenderKey(ctx.orgId, tenderId);
  return { name: decryptName(dek, file.id, file.nameEnc), data: decryptBytes(dek, await storage().get(file.storageKey), aad.file(file.id)) };
}

export interface DeletionReport {
  tenderId: string;
  keyDestroyed: boolean;
  objectsDeleted: number;
  rowsDeleted: { tenders: number; files: number; pages: number; chunks: number; jobs: number };
}

/**
 * حذف نهائي (للمالك فقط). الترتيب مقصود:
 *  1) إتلاف مفتاح المنافسة أولاً — فحتى لو تعثّرت خطوة لاحقة يصبح كل ما تبقى غير قابل للقراءة.
 *  2) حذف الملفات من التخزين.
 *  3) حذف الصفوف (بالتتالي: الملفات، الصفحات، المقاطع، المهام، الطابور).
 *  4) قيد في سجل التدقيق بالأعداد فقط — بلا عنوان المنافسة أو أي نص منها.
 * حدود هذا الحذف موثّقة في docs/security.md.
 */
export async function hardDeleteTender(ctx: OrgContext, tenderId: string, req?: RequestMeta): Promise<DeletionReport> {
  const counts = await withOrg(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner"]);
    const [t] = await tx.select({ id: tenders.id }).from(tenders).where(eq(tenders.id, tenderId));
    if (!t) throw notFound("tender");
    const count = async (table: typeof files | typeof documentPages | typeof chunks | typeof processingJobs) =>
      (await tx.select({ n: sql<number>`count(*)::int` }).from(table).where(eq(table.tenderId, tenderId)))[0].n;
    return { files: await count(files), pages: await count(documentPages), chunks: await count(chunks), jobs: await count(processingJobs) };
  });

  const keyDestroyed = await destroyTenderKey(ctx.orgId, tenderId);
  const objectsDeleted = await storage().deletePrefix(tenderPrefix(ctx.orgId, tenderId));

  const deleted = await withOrg(ctx, async (tx) => {
    const res = await tx.delete(tenders).where(eq(tenders.id, tenderId)).returning({ id: tenders.id });
    await audit(tx, ctx, "tender.deleted", "tender", tenderId, { keyDestroyed, objectsDeleted, ...counts }, req);
    return res.length;
  });

  return { tenderId, keyDestroyed, objectsDeleted, rowsDeleted: { tenders: deleted, ...counts } };
}
