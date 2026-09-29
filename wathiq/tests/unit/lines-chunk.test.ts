import { describe, expect, it } from "vitest";
import { buildPageContent, garbleRatio, type Fragment } from "@/server/pipeline/lines";
import { chunkPages, detectSectionRef, isClauseStart, CHUNK_LIMITS } from "@/server/pipeline/chunk";

const frag = (str: string, x0: number, x1: number, dir: "rtl" | "ltr", baseline = 100): Fragment => ({ str, x0, x1, baseline, size: 12, dir });

describe("line reconstruction", () => {
  it("orders RTL glyphs stored in visual order and applies NFKC to presentation forms", () => {
    // "باب" مخزّنة بصرياً يسار→يمين بأشكال العرض: ﺏ(نهائية) ﺎ ﺑ(بدائية)
    const content = buildPageContent([frag("ﺐ", 10, 16, "rtl"), frag("ﺎ", 16, 20, "rtl"), frag("ﺑ", 20, 26, "rtl")]);
    expect(content.text).toBe("باب");
    expect(content.words).toHaveLength(1);
    expect(content.words[0].b[0]).toBe(10);
    expect(content.words[0].b[2]).toBe(26);
  });

  it("keeps LTR runs (numbers, Latin) in reading order inside an Arabic line", () => {
    // سطر عربي: "شهادة ISO 9001" — بصرياً يسار→يمين: [ISO] [9001] [شهادة]
    const content = buildPageContent([
      frag("ISO", 10, 30, "ltr"),
      frag("9001", 40, 70, "ltr"),
      frag("شهادة", 80, 120, "rtl"),
    ]);
    expect(content.text).toBe("شهادة ISO 9001");
  });

  it("separates lines by baseline and records word offsets", () => {
    const content = buildPageContent([frag("سطر أول", 10, 60, "rtl", 100), frag("سطر ثان", 10, 60, "rtl", 130)]);
    expect(content.text).toBe("سطر أول\nسطر ثان");
    const w = content.words.find((x) => x.t === "ثان")!;
    expect(content.text.slice(w.o, w.o + w.t.length)).toBe("ثان");
  });

  it("detects garbled text layers (mis-encoded Arabic)", () => {
    expect(garbleRatio("ÇáÔÑæØ æÇáãæÇÕÝÇÊ")).toBeGreaterThan(0.5);
    expect(garbleRatio("الشروط والمواصفات")).toBe(0);
  });
});

describe("chunking", () => {
  it("detects clause numbering in Latin and Arabic-Indic digits", () => {
    expect(detectSectionRef("2.1 يجب على المتنافس")).toBe("2.1");
    expect(detectSectionRef("٣٫٢ يلتزم المقاول")).toBe("3.2");
    expect(isClauseStart("أولاً: نطاق العمل")).toBe(true);
    expect(isClauseStart("المادة الخامسة: الضمانات")).toBe(true);
    expect(isClauseStart("والصيانة.")).toBe(false);
  });

  it("keeps page numbers and offsets for every chunk and splits long text", () => {
    const long = Array.from({ length: 40 }, (_, i) => `${i + 1}.1 يلتزم المتنافس بتقديم المستندات المطلوبة كاملة وفق النموذج المعتمد لدى الجهة.`).join("\n");
    const pages = [
      { pageNo: 1, text: "القسم الأول: مقدمة\n1.1 نص تمهيدي." },
      { pageNo: 2, text: long },
    ];
    const chunks = chunkPages(pages);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(CHUNK_LIMITS.maxChars);
      for (const s of c.spans) {
        const page = pages.find((p) => p.pageNo === s.page)!;
        expect(c.text).toContain(page.text.slice(s.start, s.end).split("\n")[0]);
      }
    }
    expect(chunks[0].pageStart).toBe(1);
    expect(chunks.at(-1)!.pageEnd).toBe(2);
    expect(chunks.at(-1)!.sectionRef).toMatch(/^\d+\.1$/);
  });
});
