import { describe, expect, it } from "vitest";
import { normalizeText, normalizeWithMap, charSimilarity } from "@/server/analysis/normalize";
import { extractNumbers, numbersSubset } from "@/server/analysis/numbers";
import { PageIndex, verifyQuote, type PageForVerify } from "@/server/analysis/verify";
import { buildPageContent } from "@/server/pipeline/lines";

/** صفحة اصطناعية: كل سطر بخط قاعدة مستقل، والكلمات بمواضع وثقة. */
function page(lines: string[], opts: { low?: boolean; conf?: number } = {}): PageForVerify {
  const frags = lines.flatMap((line, i) =>
    line.split(" ").map((w, k, all) => ({
      str: w,
      x0: 500 - (k + 1) * 40,
      x1: 500 - k * 40 - 5,
      baseline: 100 + i * 30,
      size: 12,
      dir: "rtl" as const,
      isWord: true,
      conf: opts.conf,
      _n: all.length,
    })),
  );
  const content = buildPageContent(frags);
  return { text: content.text, words: content.words, lowConfidence: !!opts.low };
}

const P2 = [
  "القسم الثاني: الأحكام العامة",
  "2.2 يجب تقديم شهادة سارية من هيئة الزكاة والضريبة والجمارك.",
  "2.3 يلتزم المتنافس بتقديم ضمان ابتدائي بنسبة 2% من قيمة العرض، ويستبعد العرض غير المصحوب بالضمان.",
];
const P3 = ["3.1 مدة التنفيذ ستة وثلاثون شهراً من تاريخ استلام الموقع.", "3.2 يجب ألا تقل خبرة مدير المشروع عن عشر سنوات."];

const idx = (pages: Record<number, PageForVerify>) => new PageIndex(new Map(Object.entries(pages).map(([k, v]) => [Number(k), v])));

describe("Arabic normalization", () => {
  it("unifies hamza, taa marbuta, alef maqsura, diacritics, tatweel and digits", () => {
    expect(normalizeText("الإسـكان ومؤسَّسة المستشفى ١٤٤٦")).toBe("الاسكان وموسسه المستشفي 1446");
    expect(normalizeText("ﻻ تقل")).toBe("لا تقل");
  });
  it("keeps a map back to original offsets", () => {
    const src = "يجب، تقديم الشهادة";
    const n = normalizeWithMap(src);
    const at = n.norm.indexOf("الشهاده");
    expect(src.slice(n.map[at])).toBe("الشهادة");
  });
  it("char similarity", () => {
    expect(charSimilarity("abc", "abc")).toBe(1);
    expect(charSimilarity("abcd", "abcx")).toBe(0.75);
  });
});

describe("number extraction", () => {
  it("normalizes digits, thousands separators, decimals, percents and dates", () => {
    expect(extractNumbers("1,500 ريال و ٢٪ و 2.50 و 1446/05/12")).toEqual(["1446", "12", "1500", "2", "2.5", "5"].sort());
    expect(extractNumbers("%40")).toEqual(extractNumbers("40%"));
  });
  it("reads Arabic number words", () => {
    expect(extractNumbers("ستة وثلاثون شهراً")).toEqual(["36"]);
    expect(extractNumbers("عشر سنوات")).toEqual(["10"]);
    expect(extractNumbers("ثلاثة آلاف ريال")).toEqual(["3000"]);
    expect(extractNumbers("خمسة عشر يوماً")).toEqual(["15"]);
    expect(extractNumbers("القسم الثاني")).toEqual([]);
  });
  it("subset check is multiset-aware", () => {
    expect(numbersSubset(["2"], ["2", "3"])).toBe(true);
    expect(numbersSubset(["2", "2"], ["2", "3"])).toBe(false);
  });
});

describe("quote verification", () => {
  const pages = idx({ 2: page(P2), 3: page(P3), 4: page(["4.1 التقييم الفني بوزن 60% والتقييم المالي بوزن 40%."]) });

  it("verified: exact quote on the stated page, with highlight rects", () => {
    const r = verifyQuote({ quote: "يجب تقديم شهادة سارية من هيئة الزكاة", page: 2 }, pages);
    expect(r.status).toBe("verified");
    expect(r.matchedPage).toBe(2);
    expect(r.rects.length).toBeGreaterThan(0);
    expect(r.rects.every((x) => x.page === 2)).toBe(true);
  });

  it("verified despite hamza/diacritic/punctuation differences", () => {
    const r = verifyQuote({ quote: "يلتزم المتنافس بتقديم ضمان ابتدائى بنسبة 2٪ من قيمة العرض", page: 2 }, pages);
    expect(r.status).toBe("verified");
  });

  it("verified_corrected_page: found within ±2 pages", () => {
    const r = verifyQuote({ quote: "مدة التنفيذ ستة وثلاثون شهراً", page: 2 }, pages);
    expect(r.status).toBe("verified_corrected_page");
    expect(r.matchedPage).toBe(3);
    expect(r.reasons).toContain("page_corrected");
  });

  it("unverified: invented quote", () => {
    const r = verifyQuote({ quote: "يجب تقديم شهادة الأيزو 27001 في أمن المعلومات", page: 2 }, pages);
    expect(r.status).toBe("unverified");
    expect(r.reasons).toEqual(["not_found"]);
  });

  it("fuzzy is not accepted for quotes shorter than 25 normalized chars", () => {
    // 19 حرفاً بعد التوحيد وبكلمة مبتورة: لا مطابقة حرفية، والتقريبية ممنوعة
    const r = verifyQuote({ quote: "ساريه من هيئه الزكا", page: 2 }, pages);
    expect(verifyQuote({ quote: "شهادة ساريه من هيئه الزكا", page: 2 }, pages).status).toBe("needs_review"); // 25 حرفاً: التقريبية مسموحة
    expect(r.status).toBe("unverified");
    expect(r.reasons).toEqual(["quote_too_short_for_fuzzy"]);
  });

  it("fuzzy ≥ 90% on a long quote is needs_review, never verified", () => {
    const r = verifyQuote({ quote: "يلتزم المتنافس بتقديم ضمان ابتداي بنسبه 2% من قيمه العرض ويستبعد العرض", page: 2 }, pages);
    expect(r.status).toBe("needs_review");
    expect(r.reasons).toContain("fuzzy_match");
    expect(r.similarity).toBeGreaterThanOrEqual(0.9);
  });

  it("any number difference forces needs_review even above the fuzzy threshold", () => {
    const r = verifyQuote({ quote: "يلتزم المتنافس بتقديم ضمان ابتدائي بنسبة 5% من قيمة العرض، ويستبعد العرض غير المصحوب بالضمان", page: 2 }, pages);
    expect(r.similarity).toBeGreaterThan(0.9);
    expect(r.status).toBe("needs_review");
    expect(r.reasons).toContain("number_mismatch");
  });

  it("a claimed value whose number is not in the source forces needs_review", () => {
    const ok = verifyQuote({ quote: "التقييم الفني بوزن 60%", page: 4, claims: ["60%"] }, pages);
    expect(ok.status).toBe("verified");
    const bad = verifyQuote({ quote: "التقييم الفني بوزن 60%", page: 4, claims: ["70%"] }, pages);
    expect(bad.status).toBe("needs_review");
    expect(bad.reasons).toContain("value_numbers_not_in_source");
    // رقم بالحروف في المصدر يطابق رقماً بالأرقام في القيمة
    expect(verifyQuote({ quote: "مدة التنفيذ ستة وثلاثون شهراً", page: 3, claims: ["36 شهراً"] }, pages).status).toBe("verified");
  });

  it("numbers from low-confidence OCR pages are always needs_review", () => {
    const low = idx({ 7: page(["الضمان النهائي بنسبة 5% من قيمة العقد"], { low: true }) });
    expect(verifyQuote({ quote: "الضمان النهائي بنسبة 5% من قيمة العقد", page: 7 }, low)).toMatchObject({
      status: "needs_review",
      reasons: ["low_ocr_numbers"],
    });
    // نفس الصفحة الضعيفة بلا أرقام: موثّق
    const lowText = idx({ 7: page(["يجب تقديم خطة السلامة المعتمدة"], { low: true }) });
    expect(verifyQuote({ quote: "يجب تقديم خطة السلامة المعتمدة", page: 7 }, lowText).status).toBe("verified");
    // كلمة رقمية بثقة منخفضة في صفحة جيدة
    const lowWord = idx({ 8: page(["الغرامة 10% من قيمة البند"], { conf: 40 }) });
    expect(verifyQuote({ quote: "الغرامة 10% من قيمة البند", page: 8 }, lowWord).reasons).toContain("low_ocr_numbers");
  });

  it("by default any number from an OCR page needs review, even on a good page (policy 'all')", () => {
    const ocrPage = { ...page(["يلتزم المتنافس بتقديم ضمان ابتدائي بنسبة 962 من قيمة العرض"], { conf: 92 }), ocr: true };
    const pages2 = idx({ 2: ocrPage });
    const q = { quote: "بتقديم ضمان ابتدائي بنسبة 962 من قيمة العرض", page: 2 };
    expect(verifyQuote(q, pages2)).toMatchObject({ status: "needs_review", reasons: ["ocr_numbers"] });
    expect(verifyQuote(q, pages2, { ocrNumbers: "low" }).status).toBe("verified");
    // بلا أرقام: موثّق حتى من صفحة OCR
    expect(verifyQuote({ quote: "يلتزم المتنافس بتقديم ضمان ابتدائي", page: 2 }, pages2).status).toBe("verified");
  });

  it("no source / out-of-range page", () => {
    expect(verifyQuote({ quote: "", page: 2 }, pages).reasons).toEqual(["no_source"]);
    expect(verifyQuote({ quote: "أي نص طويل بما يكفي للاختبار هنا", page: 40 }, pages).reasons).toEqual(["page_out_of_range"]);
  });

  it("matches a quote that runs across a page break", () => {
    const two = idx({ 5: page(["يلتزم المقاول بتوفير فريق صيانة"]), 6: page(["وقائية يعمل على مدار الساعة"]) });
    const r = verifyQuote({ quote: "بتوفير فريق صيانة وقائية يعمل", page: 5 }, two);
    expect(r.status).toBe("verified");
    expect(new Set(r.rects.map((x) => x.page))).toEqual(new Set([5, 6]));
  });
});
