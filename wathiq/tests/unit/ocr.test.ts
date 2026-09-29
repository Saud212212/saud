import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ocrPage, setOcrEngine, type OcrEngine } from "@/server/pipeline/ocr";

const dir = mkdtempSync(path.join(os.tmpdir(), "wathiq-ocr-test-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  setOcrEngine(undefined);
});

describe("OCR (tesseract ara+eng)", () => {
  it("recognizes Arabic text on a scanned page with word boxes and a confidence score", async () => {
    const r = await ocrPage("tests/fixtures/scanned.pdf", 2, dir);
    expect(r.content.text).toContain("الأحكام العامة");
    expect(r.content.text).toContain("هيئة الزكاة والضريبة والجمارك");
    expect(r.confidence).toBeGreaterThan(70);
    const w = r.content.words.find((x) => x.t === "الزكاة")!;
    expect(w).toBeDefined();
    expect(w.c).toBeGreaterThan(50);
    // الإحداثيات بنقاط PDF (صفحة A4 ≈ 595×842)
    expect(w.b[2]).toBeLessThan(596);
    expect(w.b[3]).toBeLessThan(842);
  });

  it("the engine is swappable behind the OcrEngine interface", async () => {
    const fake: OcrEngine = {
      name: "fake",
      async recognize() {
        return [
          { text: "نص", box: [300, 100, 400, 150], conf: 40, lineKey: "1" },
          { text: "تجريبي", box: [100, 100, 280, 150], conf: 40, lineKey: "1" },
        ];
      },
    };
    setOcrEngine(fake);
    const r = await ocrPage("tests/fixtures/scanned.pdf", 1, dir);
    expect(r.content.text).toBe("نص تجريبي");
    expect(r.confidence).toBe(40);
    setOcrEngine(undefined);
  });
});
