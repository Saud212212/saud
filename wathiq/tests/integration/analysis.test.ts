/**
 * معيار قبول المرحلة 2 (بنموذج مُبرمَج بأخطاء معروفة — انظر tests/support/scripted-llm.ts):
 * كل متطلب بمصدره وموضعه، التحقق من كل اقتباس، الدمج بلا حذف صامت، والملخص بحالة تحقق لكل حقل.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/server/db/client";
import { closeKeystore } from "@/server/crypto/keystore";
import { createTender, getTenderDetail, getPageContent } from "@/server/services/tenders";
import {
  getAnalysisJob,
  getSummary,
  listItems,
  listRequirements,
  matrixCounts,
  requestAnalysis,
  resolveSimilarGroup,
  type RequirementView,
} from "@/server/services/analysis";
import { seed } from "../../scripts/seed";
import { admin, drainQueue, editorA, fixture, ownerA } from "./helpers";

let tenderId: string;
let reqs: RequirementView[];
const find = (re: RegExp, file = "text.pdf") => reqs.filter((r) => re.test(r.text) && r.source.fileName === file);

beforeAll(async () => {
  await seed();
  await admin((c) => c.query("delete from job_queue"));
  tenderId = (
    await createTender(editorA, {
      title: "منافسة التحليل",
      files: [fixture("text"), { ...fixture("scanned"), role: "annex" }, { ...fixture("mixed"), role: "annex" }],
    })
  ).tenderId;
  expect(await drainQueue()).toEqual(["succeeded", "succeeded"]);
  reqs = await listRequirements(ownerA, tenderId);
});

afterAll(async () => {
  await closeDb();
  await closeKeystore();
});

describe("compliance matrix", () => {
  it("every shown requirement has a source, a verified position and highlight rectangles", () => {
    const shown = reqs.filter((r) => r.source.verification !== "unverified");
    expect(shown.length).toBeGreaterThanOrEqual(15);
    for (const r of shown) {
      expect(r.source.fileName).toBeTruthy();
      expect(r.source.matchedPage).toBeGreaterThan(0);
      expect(r.source.quote).toBeTruthy();
      expect(r.source.rects.length).toBeGreaterThan(0);
      expect(r.source.rects.every((x) => x.b[2] > x.b[0] && x.b[3] > x.b[1])).toBe(true);
    }
  });

  it("the highlight rectangles land on the words of the quote in the page", async () => {
    const zakat = find(/الزكاة/)[0];
    const page = await getPageContent(ownerA, tenderId, zakat.source.tenderFileId!, zakat.source.matchedPage!);
    const rect = zakat.source.rects[0].b;
    const inside = page.content.words.filter((w) => w.b[0] >= rect[0] - 1 && w.b[2] <= rect[2] + 1 && w.b[1] >= rect[1] - 1 && w.b[3] <= rect[3] + 1);
    expect(inside.map((w) => w.t).join(" ")).toContain("الزكاة");
  });

  it("final codes are assigned by the code after merging, in document order (REQ-001…)", () => {
    const shown = reqs.filter((r) => r.source.verification !== "unverified");
    expect(shown.map((r) => r.code)).toEqual(shown.map((_, i) => `REQ-${String(i + 1).padStart(3, "0")}`));
    // المعرّف المحلي من النموذج محفوظ للتتبع فقط
    expect(reqs.every((r) => !/^r\d+$/.test(r.code))).toBe(true);
  });

  it("an invented requirement is unverified, gets a UNV code and is not a confirmed requirement", () => {
    const fake = reqs.find((r) => r.text.includes("27001"))!;
    expect(fake.source.verification).toBe("unverified");
    expect(fake.code).toMatch(/^UNV-\d{3}$/);
    expect(fake.source.reasons).toContain("not_found");
    expect(matrixCounts(reqs).unverified).toBeGreaterThanOrEqual(1);
  });

  it("a wrong page within ±2 is verified with a corrected page number", () => {
    const r = find(/خبرة مدير المشروع/)[0];
    expect(r.source.verification).toBe("verified_corrected_page");
    expect(r.source.statedPage).toBe(4);
    expect(r.source.matchedPage).toBe(3);
  });

  it("a number in the requirement that differs from the source forces needs_review", () => {
    const r = find(/ضمان ابتدائي/)[0];
    expect(r.text).toContain("5%");
    expect(r.source.verification).toBe("needs_review");
    expect(r.source.reasons).toContain("value_numbers_not_in_source");
  });

  it("numbers from low-confidence OCR pages are needs_review", () => {
    const ocr = reqs.filter((r) => r.source.fileName === "scanned.pdf" && r.source.verification !== "unverified");
    expect(ocr.length).toBeGreaterThan(0);
    const withNumbers = ocr.filter((r) => /\d/.test(r.source.matchedText ?? ""));
    expect(withNumbers.length).toBeGreaterThan(0);
    for (const r of withNumbers) {
      expect(r.source.verification).toBe("needs_review");
      expect(r.source.reasons).toContain("low_ocr_numbers");
    }
  });

  it("exact duplicates (same text AND source) are removed; the same clause from another file is kept and flagged similar", async () => {
    const zakatText = find(/الزكاة/);
    expect(zakatText).toHaveLength(1);
    expect(zakatText[0].mergedLocalIds.length).toBe(1);
    const zakatScanned = find(/الزكاة/, "scanned.pdf");
    expect(zakatScanned.length).toBeGreaterThanOrEqual(1);
    expect(zakatScanned[0].similarGroupId).toBeTruthy();
    expect(zakatScanned[0].similarGroupId).toBe(zakatText[0].similarGroupId);
    const job = await getAnalysisJob(ownerA, tenderId);
    expect((job!.detail as { stats: { exactDuplicatesRemoved: number } }).stats.exactDuplicatesRemoved).toBeGreaterThanOrEqual(1);
  });

  it("disqualifying and preferred obligations come through", () => {
    expect(find(/ضمان ابتدائي/)[0].disqualifying).toBe(true);
    expect(find(/الأيزو 9001/)[0].obligation).toBe("preferred");
  });

  it("merging a similar group is a user decision, logged, and only removes what the user chose", async () => {
    const group = find(/الزكاة/)[0].similarGroupId!;
    const members = reqs.filter((r) => r.similarGroupId === group);
    await expect(resolveSimilarGroup(ownerA, tenderId, group, { action: "keep_all" })).resolves.toMatchObject({ removed: 0 });
    const after = await listRequirements(ownerA, tenderId);
    expect(after.filter((r) => members.some((m) => m.id === r.id)).every((r) => r.mergeDecision === "kept_separate" && r.similarGroupId === null)).toBe(true);
    const log = await admin((c) => c.query(`select count(*)::int n from audit_logs where action = 'requirements.kept_separate' and entity_id = $1`, [tenderId]));
    expect(log.rows[0].n).toBe(1);
  });
});

describe("tender summary", () => {
  it("each summary field has a value and a verification status", async () => {
    const s = await getSummary(ownerA, tenderId);
    const primary = (f: string) => s.get(f)?.find((x) => x.isPrimary);
    expect(primary("entity")?.value.value).toBe("وزارة الشؤون البلدية والقروية والإسكان");
    expect(primary("entity")?.source.verification).toBe("verified");
    expect(primary("booklet_price")?.value.value).toContain("1500");
    expect(primary("evaluation.technical_weight")?.value.value).toBe("60%");
    expect(primary("evaluation.min_technical_score")).toBeTruthy();
    for (const list of s.values()) for (const f of list) expect(["verified", "verified_corrected_page", "needs_review", "unverified"]).toContain(f.source.verification);
    // الحقل الأساسي يُختار من الأقوى تحققاً (النص الأصلي قبل الـ OCR منخفض الثقة)
    expect(primary("booklet_price")?.source.fileName).toBe("text.pdf");
  });

  it("fills an empty agency in the (encrypted) tender metadata from a verified fact", async () => {
    const d = await getTenderDetail(ownerA, tenderId);
    expect(d.tender.agency).toBe("وزارة الشؤون البلدية والقروية والإسكان");
  });
});

describe("robustness and traceability", () => {
  it("a chunk that fails twice is reported, while the rest of the analysis succeeds", async () => {
    const job = await getAnalysisJob(ownerA, tenderId);
    const d = job!.detail as { chunksFailed: number; failedChunks: { file: number }[] };
    expect(job!.status).toBe("succeeded");
    expect(d.chunksFailed).toBe(1);
    expect(d.failedChunks[0].file).toBe(3);
  });

  it("every model call is logged with the prompt version, fingerprint and model, output encrypted", async () => {
    const runs = await admin((c) => c.query(`select * from ai_runs where tender_id = $1`, [tenderId]));
    const chunkCount = await admin(async (c) => (await c.query(`select count(*)::int n from chunks where tender_id = $1`, [tenderId])).rows[0].n);
    expect(runs.rows.length).toBe(chunkCount);
    for (const r of runs.rows) {
      expect(r.prompt_version).toBe("1.0.0");
      expect(r.rules_version).toBe("1.0.0");
      expect(r.prompt_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(r.model_requested).toBe("claude-opus-5-5");
      if (r.output_enc) expect(r.output_enc.includes(Buffer.from("يجب"))).toBe(false);
    }
    const repaired = runs.rows.filter((r) => r.attempts === 2 && r.status === "ok");
    expect(repaired.length).toBe(1); // الملف 2: JSON تالف ثم مُصلح
  });

  it("requirement text, quotes and summary values are encrypted at rest", async () => {
    const rows = await admin((c) =>
      c.query(`select content_enc as e from requirements where tender_id = $1 union all select value_enc from tender_facts where tender_id = $1 union all select source_enc from tender_facts where tender_id = $1`, [tenderId]),
    );
    for (const r of rows.rows) for (const s of ["الزكاة", "وزارة", "1500"]) expect(r.e.includes(Buffer.from(s))).toBe(false);
  });

  it("other extracted items (verify notes) are stored", async () => {
    const items = await listItems(ownerA, tenderId);
    expect(items.some((i) => i.kind === "verify_note")).toBe(true);
  });

  it("re-running the analysis replaces the previous result (idempotent)", async () => {
    const before = (await listRequirements(ownerA, tenderId)).length;
    await expect(requestAnalysis(editorA, tenderId)).resolves.toBeTruthy();
    expect(await drainQueue()).toEqual(["succeeded"]);
    // قرار "إبقاء منفصلة" السابق يُمسح لأن التحليل أُعيد من الصفر
    expect((await listRequirements(ownerA, tenderId)).length).toBe(before);
  });
});
