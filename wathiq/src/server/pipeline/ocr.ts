import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";
import { buildPageContent, fragmentDir, meaningfulCharCount, type Fragment } from "./lines";
import type { PageContent } from "./types";

/**
 * واجهة محرك OCR — قابلة للاستبدال (Tesseract محلياً الآن؛ لاحقاً مزود سحابي أو نموذج أحدث).
 * المحرك يستقبل صورة الصفحة ويُرجع كلمات بإحداثيات البكسل وثقة لكل كلمة.
 */
export interface OcrWord {
  text: string;
  /** بالبكسل: يسار، أعلى، يمين، أسفل */
  box: [number, number, number, number];
  /** 0..100 */
  conf: number;
  /** معرّف السطر (لتجميع الكلمات) */
  lineKey: string;
}

export interface OcrEngine {
  readonly name: string;
  recognize(png: Buffer, opts: OcrOptions): Promise<OcrWord[]>;
}

export interface OcrOptions {
  langs: string;
  dpi: number;
  psm?: number;
  tessdataDir?: string;
}

export interface OcrPageResult {
  content: PageContent;
  /** متوسط ثقة الكلمات موزوناً بعدد الحروف (0..100) */
  confidence: number | null;
  meaningfulChars: number;
}

function run(cmd: string, args: string[], input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Tesseract يستخدم OpenMP على كل الأنوية؛ مع تشغيل عدة صفحات بالتوازي يحدث تزاحم حاد
    // (قيس: صفحتان بالتوازي > 3 دقائق بدونه، و1.5 ثانية معه). التوازي يكون بين الصفحات.
    const p = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, OMP_THREAD_LIMIT: "1" } });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${cmd} exited ${code}: ${Buffer.concat(err).toString().slice(0, 500)}`));
    });
    p.stdin.end(input);
  });
}

export class TesseractEngine implements OcrEngine {
  readonly name = "tesseract";

  async recognize(png: Buffer, opts: OcrOptions): Promise<OcrWord[]> {
    // --tessdata-dir يجب أن يسبق بقية الوسائط؛ و-c بدل ملف إعداد "tsv" حتى لا نعتمد على configs/ في مجلد النماذج
    const args = opts.tessdataDir ? ["--tessdata-dir", opts.tessdataDir] : [];
    args.push("stdin", "stdout", "-l", opts.langs, "--dpi", String(opts.dpi), "--psm", String(opts.psm ?? 3));
    args.push("-c", "tessedit_create_tsv=1");
    const tsv = (await run("tesseract", args, png)).toString("utf8");
    const words: OcrWord[] = [];
    for (const line of tsv.split("\n").slice(1)) {
      const c = line.split("\t");
      if (c.length < 12 || c[0] !== "5") continue;
      const text = c.slice(11).join("\t").trim();
      const conf = Number(c[10]);
      if (!text || conf < 0) continue;
      const [left, top, width, height] = [c[6], c[7], c[8], c[9]].map(Number);
      words.push({ text, box: [left, top, left + width, top + height], conf, lineKey: `${c[2]}.${c[3]}.${c[4]}` });
    }
    return words;
  }
}

let engine: OcrEngine | undefined;
export function ocrEngine(): OcrEngine {
  if (!engine) {
    switch (env().OCR_ENGINE) {
      case "tesseract":
        engine = new TesseractEngine();
        break;
    }
  }
  return engine!;
}

/** للاختبارات: تبديل المحرك. */
export function setOcrEngine(e: OcrEngine | undefined) {
  engine = e;
}

/** يرسم صفحة واحدة إلى PNG رمادي بدقة dpi (poppler pdftoppm). */
export async function renderPage(pdfPath: string, pageNo: number, dpi: number, workDir: string): Promise<Buffer> {
  const prefix = path.join(workDir, `p${pageNo}`);
  await run("pdftoppm", ["-f", String(pageNo), "-l", String(pageNo), "-r", String(dpi), "-gray", "-png", "-singlefile", pdfPath, prefix]);
  return readFile(`${prefix}.png`);
}

/** OCR لصفحة: رسم ← تعرّف ← تحويل البكسل لنقاط PDF ← بناء النص بنفس منطق طبقة النص. */
export async function ocrPage(pdfPath: string, pageNo: number, workDir: string): Promise<OcrPageResult> {
  const { OCR_DPI: dpi, OCR_LANGS: langs, OCR_PSM: psm, OCR_TESSDATA_DIR: tessdataDir } = env();
  const png = await renderPage(pdfPath, pageNo, dpi, workDir);
  const words = await ocrEngine().recognize(png, { langs, dpi, psm, tessdataDir });
  const k = 72 / dpi;

  // نحوّل كل كلمة لقطعة؛ خط القاعدة = أسفل السطر (نوحّده لكل سطر حتى لا تتفكك الأسطر)
  const lineBottom = new Map<string, number>();
  const lineSize = new Map<string, number>();
  for (const w of words) {
    lineBottom.set(w.lineKey, Math.max(lineBottom.get(w.lineKey) ?? 0, w.box[3]));
    lineSize.set(w.lineKey, Math.max(lineSize.get(w.lineKey) ?? 0, w.box[3] - w.box[1]));
  }
  const frags: Fragment[] = words.map((w) => ({
    str: w.text,
    x0: w.box[0] * k,
    x1: w.box[2] * k,
    baseline: (lineBottom.get(w.lineKey)! - (lineSize.get(w.lineKey)! * 0.2)) * k,
    size: lineSize.get(w.lineKey)! * k,
    dir: fragmentDir(w.text) === "rtl" ? "rtl" : "ltr",
    conf: w.conf,
    isWord: true,
  }));
  const content = buildPageContent(frags);

  let weighted = 0;
  let chars = 0;
  for (const w of words) {
    const n = meaningfulCharCount(w.text);
    weighted += w.conf * n;
    chars += n;
  }
  return {
    content,
    confidence: chars ? Math.round((weighted / chars) * 10) / 10 : null,
    meaningfulChars: meaningfulCharCount(content.text),
  };
}
