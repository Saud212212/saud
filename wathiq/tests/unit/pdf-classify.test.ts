import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { openPdf, analyzeTextLayer } from "@/server/pipeline/pdf-text";
import { classifyPage, detectBackgroundSignatures } from "@/server/pipeline/classify";
import type { ClassifiedPage } from "@/server/pipeline/types";

async function classifyFixture(name: string): Promise<ClassifiedPage[]> {
  const doc = await openPdf(new Uint8Array(readFileSync(`tests/fixtures/${name}.pdf`)));
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) pages.push(await analyzeTextLayer(await doc.getPage(i)));
  const bg = detectBackgroundSignatures(pages);
  return pages.map((p) => classifyPage(p, bg));
}

describe("page classification (fixtures)", () => {
  it("text booklet: every page is a text page", async () => {
    const pages = await classifyFixture("text");
    expect(pages.map((p) => p.kind)).toEqual(["text", "text", "text", "text"]);
    expect(pages.every((p) => !p.needsOcr)).toBe(true);
  });

  it("scanned booklet: every page needs OCR", async () => {
    const pages = await classifyFixture("scanned");
    expect(pages.map((p) => p.kind)).toEqual(["scanned", "scanned", "scanned", "scanned"]);
  });

  it("mixed booklet: text, text, scanned, scanned-with-text-stamp", async () => {
    const pages = await classifyFixture("mixed");
    expect(pages.map((p) => p.kind)).toEqual(["text", "text", "scanned", "scanned"]);
    // الصفحة 4 عليها ختم نصي لاتيني فوق صورة — يجب ألا تُعامل كنصية
    expect(pages[3].meaningfulChars).toBeGreaterThan(0);
  });
});

describe("text layer extraction", () => {
  it("reconstructs Arabic text in logical order", async () => {
    const [, p2] = await classifyFixture("text");
    expect(p2.content.text).toContain("2.2 يجب تقديم شهادة سارية من هيئة الزكاة والضريبة والجمارك.");
    expect(p2.content.text).toContain("شهادة الأيزو 9001 في إدارة الجودة");
    expect(p2.content.text).toContain("القسم الثاني: الأحكام العامة");
  });

  it("returns word coordinates inside the page, ordered right-to-left on Arabic lines", async () => {
    const [, p2] = await classifyFixture("text");
    const { words, text } = p2.content;
    expect(words.length).toBeGreaterThan(50);
    for (const w of words) {
      expect(w.b[0]).toBeGreaterThanOrEqual(0);
      expect(w.b[2]).toBeLessThanOrEqual(p2.width);
      expect(w.b[1]).toBeGreaterThanOrEqual(0);
      expect(w.b[3]).toBeLessThanOrEqual(p2.height);
      expect(w.b[2]).toBeGreaterThan(w.b[0]);
      expect(text.slice(w.o, w.o + w.t.length)).toBe(w.t);
    }
    const i = words.findIndex((w) => w.t === "القسم");
    expect(words[i + 1].t).toBe("الثاني:");
    expect(words[i + 1].b[2]).toBeLessThanOrEqual(words[i].b[0] + 1); // الكلمة التالية على اليسار
  });
});
