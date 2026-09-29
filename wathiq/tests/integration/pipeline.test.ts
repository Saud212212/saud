/**
 * معيار قبول المرحلة 1 من طرف لطرف:
 * رفع كراسة نصية وممسوحة ومختلطة ← تصنيف الصفحات ← نص + إحداثيات ← تقدم ← حذف نهائي.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/server/db/client";
import { closeKeystore, getTenderKey, TenderKeyMissingError } from "@/server/crypto/keystore";
import { storage, tenderPrefix } from "@/server/storage";
import {
  createTender,
  getJobStatus,
  getPageContent,
  getTenderDetail,
  hardDeleteTender,
  listChunks,
} from "@/server/services/tenders";
import { processOne } from "@/worker/run";
import { seed } from "../../scripts/seed";
import { admin, editorA, fixture, orgA, ownerA } from "./helpers";

let tenderId: string;
const progressSeen: { stage: string; progress: number }[] = [];

beforeAll(async () => {
  await seed();
  await admin((c) => c.query("delete from job_queue"));
});

afterAll(async () => {
  await closeDb();
  await closeKeystore();
});

describe("upload", () => {
  it("rejects files that are not really PDFs", async () => {
    await expect(
      createTender(editorA, { title: "x", files: [{ name: "a.pdf", mime: "application/pdf", data: Buffer.from("MZ not a pdf"), role: "booklet" }] }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("uploads a text, a scanned and a mixed booklet as one tender and queues extraction", async () => {
    const res = await createTender(editorA, {
      title: "تشغيل وصيانة المباني الإدارية",
      referenceNumber: "240139005712",
      files: [fixture("text"), { ...fixture("scanned"), role: "annex" }, { ...fixture("mixed"), role: "annex" }],
    });
    tenderId = res.tenderId;
    const s = await getJobStatus(editorA, tenderId);
    expect(s?.tenderStatus).toBe("processing");
    expect(s?.job).toMatchObject({ status: "queued", progress: 0 });
  });

  it("stores files encrypted at rest", async () => {
    const keys = await storage().list(tenderPrefix(orgA, tenderId));
    expect(keys).toHaveLength(3);
    for (const k of keys) {
      const raw = await storage().get(k);
      expect(raw.subarray(0, 5).toString("latin1")).not.toBe("%PDF-");
    }
  });
});

describe("extraction", () => {
  it("reports increasing progress through the stages until 100%", async () => {
    let done = false;
    const poll = (async () => {
      while (!done) {
        const s = await getJobStatus(editorA, tenderId);
        if (s?.job) {
          const last = progressSeen.at(-1);
          if (!last || last.progress !== s.job.progress) progressSeen.push({ stage: s.job.stage, progress: s.job.progress });
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    })();
    const result = await processOne("test-worker", { info() {}, warn() {}, error: console.error } as unknown as Console);
    done = true;
    await poll;
    expect(result).toBe("succeeded");

    const final = await getJobStatus(editorA, tenderId);
    expect(final?.tenderStatus).toBe("ready");
    expect(final?.job).toMatchObject({ status: "succeeded", stage: "done", progress: 100 });
    const values = progressSeen.map((p) => p.progress);
    expect(values.length).toBeGreaterThanOrEqual(4);
    expect([...values].sort((a, b) => a - b)).toEqual(values); // لا يتراجع
    expect(new Set(progressSeen.map((p) => p.stage))).toContain("ocr");
  });

  it("classifies every page correctly in each file", async () => {
    const d = await getTenderDetail(ownerA, tenderId);
    const kinds = (name: string) => {
      const f = d.files.find((x) => x.name === name)!;
      return d.pages.filter((p) => p.tenderFileId === f.id).map((p) => `${p.kind}/${p.source}`);
    };
    expect(kinds("text.pdf")).toEqual(Array(4).fill("text/text_layer"));
    expect(kinds("scanned.pdf")).toEqual(Array(4).fill("scanned/ocr"));
    expect(kinds("mixed.pdf")).toEqual(["text/text_layer", "text/text_layer", "scanned/ocr", "scanned/ocr"]);
    expect(d.files.every((f) => f.status === "done" && f.pageCount === 4)).toBe(true);
    for (const p of d.pages.filter((x) => x.source === "ocr")) expect(p.ocrConfidence).toBeGreaterThan(0);
  });

  it("extracts text with word coordinates from both text-layer and OCR pages", async () => {
    const d = await getTenderDetail(ownerA, tenderId);
    const textFile = d.files.find((f) => f.name === "text.pdf")!;
    const scanned = d.files.find((f) => f.name === "scanned.pdf")!;

    const p2 = await getPageContent(ownerA, tenderId, textFile.id, 2);
    expect(p2.content.text).toContain("هيئة الزكاة والضريبة والجمارك");
    expect(p2.content.words.length).toBeGreaterThan(50);

    const s2 = await getPageContent(ownerA, tenderId, scanned.id, 2);
    expect(s2.content.text).toContain("الزكاة");
    const w = s2.content.words.find((x) => x.t.includes("الزكاة"))!;
    expect(w.b.every((v) => Number.isFinite(v))).toBe(true);
    expect(w.c).toBeGreaterThan(0);
  });

  it("splits into chunks that keep page numbers", async () => {
    const chunks = await listChunks(ownerA, tenderId);
    expect(chunks.length).toBeGreaterThanOrEqual(6);
    for (const c of chunks) {
      expect(c.pageStart).toBeGreaterThanOrEqual(1);
      expect(c.pageEnd).toBeLessThanOrEqual(4);
      expect(c.spans.length).toBeGreaterThan(0);
    }
    expect(chunks.some((c) => c.sectionRef === "2.2" || c.text.includes("2.2"))).toBe(true);
  });

  it("stores page text and chunks encrypted in the database", async () => {
    const rows = await admin((c) =>
      c.query<{ content_enc: Buffer }>(`select content_enc from document_pages where tender_id = $1 union all select content_enc from chunks where tender_id = $1`, [tenderId]),
    );
    expect(rows.rows.length).toBeGreaterThan(12);
    for (const r of rows.rows) {
      expect(r.content_enc.includes(Buffer.from("الزكاة"))).toBe(false);
      expect(r.content_enc.includes(Buffer.from("text"))).toBe(false);
    }
  });
});

describe("hard delete", () => {
  it("only the owner can delete", async () => {
    await expect(hardDeleteTender(editorA, tenderId)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("destroys the key, the files and every row, and leaves an audit entry without content", async () => {
    // "نسخة احتياطية" من صف مشفّر قبل الحذف
    const backup = await admin(async (c) => (await c.query(`select content_enc from document_pages where tender_id = $1 limit 1`, [tenderId])).rows[0].content_enc as Buffer);
    expect(backup).toBeInstanceOf(Buffer);

    const report = await hardDeleteTender(ownerA, tenderId, { ip: "127.0.0.1", userAgent: "vitest" });
    expect(report.keyDestroyed).toBe(true);
    expect(report.objectsDeleted).toBe(3);
    expect(report.rowsDeleted).toMatchObject({ tenders: 1, files: 3, pages: 12 });

    for (const t of ["tenders", "files", "tender_files", "document_pages", "chunks", "processing_jobs", "tender_keys"]) {
      const col = t === "tenders" ? "id" : "tender_id";
      const n = await admin((c) => c.query(`select count(*)::int n from ${t} where ${col} = $1`, [tenderId]));
      expect(n.rows[0].n, t).toBe(0);
    }
    const q = await admin((c) => c.query(`select count(*)::int n from job_queue`));
    expect(q.rows[0].n).toBe(0);
    expect(await storage().list(tenderPrefix(orgA, tenderId))).toEqual([]);

    // المفتاح أُتلف: النسخة الاحتياطية غير قابلة للفك
    await expect(getTenderKey(orgA, tenderId)).rejects.toBeInstanceOf(TenderKeyMissingError);

    const log = await admin((c) => c.query(`select actor_user_id, metadata from audit_logs where action = 'tender.deleted' and entity_id = $1`, [tenderId]));
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0].actor_user_id).toBe(ownerA.userId);
    expect(JSON.stringify(log.rows[0].metadata)).not.toContain("تشغيل");
  });

  it("a second delete reports not found", async () => {
    await expect(hardDeleteTender(ownerA, tenderId)).rejects.toMatchObject({ code: "not_found" });
  });
});
