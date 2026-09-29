import { describe, expect, it } from "vitest";
import { mergeRequirements, type RequirementCandidate } from "@/server/analysis/merge";
import type { VerificationResult } from "@/server/analysis/verify";

const ok = (page: number, status: VerificationResult["status"] = "verified"): VerificationResult => ({
  status,
  reasons: [],
  matchedPage: status === "unverified" ? null : page,
  similarity: 1,
  matchedText: null,
  rects: [],
  quoteNumbers: [],
  matchedNumbers: [],
});

let n = 0;
const cand = (p: Partial<RequirementCandidate> & { text: string; page?: number }): RequirementCandidate => ({
  tmpId: `t${++n}`,
  chunkId: "c1",
  localId: `r${n}`,
  tenderFileId: "f1",
  fileOrdinal: 0,
  category: "regulatory",
  categoryRaw: "نظامي",
  obligation: "mandatory",
  disqualifying: false,
  evidenceRequired: null,
  clause: null,
  quote: p.text,
  statedPage: p.page ?? 1,
  verification: ok(p.page ?? 1),
  sortKey: n,
  ...p,
});

describe("requirement merging", () => {
  it("removes a duplicate only when text AND source match", () => {
    const a = cand({ text: "تقديم سجل تجاري ساري", page: 2 });
    const b = cand({ text: "تقديم سجل تجاري ساري", page: 2 });
    const r = mergeRequirements([a, b]);
    expect(r.exactDuplicatesRemoved).toBe(1);
    expect(r.requirements).toHaveLength(1);
    expect(r.requirements[0].mergedLocalIds).toEqual([b.localId]);
  });

  it("same text from a different source (another file or page) is kept and flagged as similar", () => {
    const a = cand({ text: "تقديم شهادة الزكاة السارية", page: 2 });
    const b = cand({ text: "تقديم شهادة الزكاة السارية", page: 2, tenderFileId: "f2", fileOrdinal: 1 });
    const r = mergeRequirements([a, b]);
    expect(r.exactDuplicatesRemoved).toBe(0);
    expect(r.requirements).toHaveLength(2);
    expect(r.similarGroups).toBe(1);
    expect(r.requirements[0].similarGroupId).toBe(r.requirements[1].similarGroupId);
  });

  it("same text and source but different attributes is a conflict to review, not a silent delete", () => {
    const a = cand({ text: "ضمان ابتدائي 2%", page: 2, disqualifying: true });
    const b = cand({ text: "ضمان ابتدائي 2%", page: 2, disqualifying: false });
    const r = mergeRequirements([a, b]);
    expect(r.requirements).toHaveLength(2);
    expect(r.similarGroups).toBe(1);
  });

  it("paraphrases of the same clause are grouped, unrelated ones are not", () => {
    const a = cand({ text: "يجب تقديم شهادة سارية من هيئة الزكاة والضريبة والجمارك", page: 2 });
    const b = cand({ text: "تقديم شهادة سارية من هيئة الزكاة والضريبة", page: 3, quote: "شهادة من هيئة الزكاة" });
    const c = cand({ text: "توفير فريق صيانة وقائية على مدار الساعة", page: 3 });
    const r = mergeRequirements([a, b, c]);
    expect(r.requirements.find((x) => x.tmpId === a.tmpId)!.similarGroupId).toBeTruthy();
    expect(r.requirements.find((x) => x.tmpId === a.tmpId)!.similarGroupId).toBe(r.requirements.find((x) => x.tmpId === b.tmpId)!.similarGroupId);
    expect(r.requirements.find((x) => x.tmpId === c.tmpId)!.similarGroupId).toBeNull();
  });

  it("assigns REQ codes in document order and UNV codes to unverified items", () => {
    const late = cand({ text: "متطلب في الصفحة 5", page: 5 });
    const early = cand({ text: "متطلب في الصفحة 1", page: 1 });
    const fake = cand({ text: "متطلب مخترع", page: 3, verification: ok(3, "unverified") });
    const r = mergeRequirements([late, fake, early]);
    const code = (t: RequirementCandidate) => r.requirements.find((x) => x.tmpId === t.tmpId)!.code;
    expect([code(early), code(late), code(fake)]).toEqual(["REQ-001", "REQ-002", "UNV-001"]);
  });
});
