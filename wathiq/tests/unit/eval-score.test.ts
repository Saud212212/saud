import { describe, expect, it } from "vitest";
import { scoreTender, type ExtractedForEval } from "../../eval/score";
import type { GoldRequirement } from "../../eval/schema";

const g = (id: string, page: number, quote: string, extra: Partial<GoldRequirement> = {}): GoldRequirement => ({
  id,
  category: "regulatory",
  text: quote,
  file: "b.pdf",
  page,
  section_ref: null,
  quote,
  obligation: "mandatory",
  disqualifying: false,
  evidence_required: null,
  notes: null,
  ...extra,
});
const e = (code: string, page: number, quote: string, extra: Partial<ExtractedForEval> = {}): ExtractedForEval => ({
  code,
  fileName: "b.pdf",
  page,
  text: quote,
  quote,
  matchedText: quote,
  obligation: "mandatory",
  category: "regulatory",
  disqualifying: false,
  verification: "verified",
  ...extra,
});

describe("eval scoring", () => {
  const gold = [
    g("G-001", 2, "يجب تقديم سجل تجاري ساري المفعول"),
    g("G-002", 2, "يجب تقديم شهادة سارية من هيئة الزكاة", { disqualifying: true }),
    g("G-003", 3, "نسبة المحتوى المحلي لا تقل عن أربعين بالمئة"),
    g("G-004", 4, "يفضل وجود شهادة الأيزو", { obligation: "preferred" }),
  ];

  it("computes mandatory recall, invented and fabricated rates", () => {
    const r = scoreTender(gold, [
      e("REQ-001", 2, "تقديم سجل تجاري ساري المفعول"),
      e("REQ-002", 3, "يجب تقديم شهادة سارية من هيئة الزكاة والضريبة"), // صفحة مجاورة (±1) تُقبل
      e("REQ-003", 5, "تقديم خطة سلامة معتمدة"), // لا مقابل مرجعي
      e("UNV-001", 3, "نسبة المحتوى المحلي لا تقل عن أربعين بالمئة", { verification: "unverified" }),
    ]);
    expect(r.metrics.mandatoryRecall).toBe(0.667); // 2 من 3 (G-003 التقطه النموذج لكن غير موثّق فلا يُحسب)
    expect(r.metrics.disqualifyingRecall).toBe(1);
    expect(r.metrics.inventedRate).toBe(0.333); // REQ-003 من 3 معروضة
    expect(r.metrics.fabricatedRate).toBe(0.25); // UNV-001 من 4
    expect(r.missedMandatory).toEqual([{ id: "G-003", page: 3, text: gold[2].text, nearestUnverified: "UNV-001" }]);
    expect(r.unmatchedExtracted.map((x) => x.code)).toEqual(["REQ-003"]);
  });

  it("does not match across files or beyond ±1 page", () => {
    const r = scoreTender([gold[0]], [
      e("REQ-001", 4, "يجب تقديم سجل تجاري ساري المفعول"),
      e("REQ-002", 2, "يجب تقديم سجل تجاري ساري المفعول", { fileName: "other.pdf" }),
    ]);
    expect(r.metrics.mandatoryRecall).toBe(0);
    expect(r.metrics.inventedRate).toBe(1);
  });

  it("measures attribute agreement on matched pairs", () => {
    const r = scoreTender([gold[1]], [e("REQ-001", 2, gold[1].quote, { disqualifying: false })]);
    expect(r.metrics.disqualifyingAgreement).toBe(0);
    expect(r.metrics.obligationAgreement).toBe(1);
  });
});
