import { createRequire } from "node:module";
import path from "node:path";
import { getDocument, OPS, Util, type PDFDocumentProxy, type PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildPageContent, fragmentDir, garbleRatio, meaningfulCharCount, type Fragment } from "./lines";
import type { PageAnalysis } from "./types";

const require = createRequire(import.meta.url);
const PDFJS_DIR = path.dirname(require.resolve("pdfjs-dist/package.json"));

export async function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  return getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
    standardFontDataUrl: path.join(PDFJS_DIR, "standard_fonts") + path.sep,
    cMapUrl: path.join(PDFJS_DIR, "cmaps") + path.sep,
    cMapPacked: true,
  }).promise;
}

type Matrix = [number, number, number, number, number, number];

interface TextItemLike {
  str: string;
  dir: string;
  transform: number[];
  width: number;
  height: number;
}

/** يستخرج طبقة النص مع الإحداثيات ومقاييس التصنيف لصفحة واحدة. */
export async function analyzeTextLayer(page: PDFPageProxy): Promise<PageAnalysis> {
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();

  const frags: Fragment[] = [];
  for (const raw of tc.items) {
    const it = raw as TextItemLike;
    if (typeof it.str !== "string" || !it.str.length) continue;
    const m = Util.transform(vp.transform, it.transform) as Matrix;
    const size = Math.hypot(m[2], m[3]) || it.height || 10;
    // العرض في فضاء المستخدم؛ نحوّله لفضاء العرض (نفس المقياس هنا = 1)
    const width = it.width * vp.scale;
    const x0 = m[4];
    const d = it.dir === "rtl" ? "rtl" : it.dir === "ltr" ? "ltr" : fragmentDir(it.str) === "rtl" ? "rtl" : "ltr";
    frags.push({ str: it.str, x0, x1: x0 + width, baseline: m[5], size, dir: d });
  }

  const content = buildPageContent(frags);
  const { images, pathOps } = await scanOperators(page);

  return {
    pageNo: page.pageNumber,
    width: round1(vp.width),
    height: round1(vp.height),
    rotation: page.rotate,
    content,
    meaningfulChars: meaningfulCharCount(content.text),
    garbleRatio: garbleRatio(content.text),
    imageCoverage: Math.min(1, images.reduce((s, i) => s + i.coverage, 0)),
    pathOps,
    images,
  };
}

/**
 * يمر على قائمة العمليات لحساب مساحة الصور (مع تتبع مصفوفة التحويل CTM)
 * وعدد عمليات الرسم المتجهي (نص محوّل إلى منحنيات يظهر كـ paths بلا طبقة نص).
 */
async function scanOperators(page: PDFPageProxy) {
  const ops = await page.getOperatorList();
  const [vx0, vy0, vx1, vy1] = page.view;
  const pageArea = Math.abs((vx1 - vx0) * (vy1 - vy0)) || 1;

  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const images: { sig: string; coverage: number }[] = [];
  let pathOps = 0;

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[];
    switch (fn) {
      case OPS.save:
        stack.push(ctm);
        break;
      case OPS.restore:
        ctm = stack.pop() ?? ctm;
        break;
      case OPS.transform:
        ctm = Util.transform(ctm, args as Matrix) as Matrix;
        break;
      case OPS.paintFormXObjectBegin: {
        stack.push(ctm);
        const matrix = args?.[0] as Matrix | null;
        if (Array.isArray(matrix) && matrix.length === 6) ctm = Util.transform(ctm, matrix) as Matrix;
        break;
      }
      case OPS.paintFormXObjectEnd:
        ctm = stack.pop() ?? ctm;
        break;
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
      case OPS.paintImageXObjectRepeat: {
        // الصورة ترسم مربع الوحدة؛ مساحتها = |det(CTM)|
        const area = Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]);
        const a = args ?? [];
        const w = typeof a[1] === "number" ? a[1] : (a[0] as { width?: number })?.width ?? 0;
        const h = typeof a[2] === "number" ? a[2] : (a[0] as { height?: number })?.height ?? 0;
        images.push({ sig: `${w}x${h}`, coverage: Math.min(1, area / pageArea) });
        break;
      }
      case OPS.constructPath:
        pathOps++;
        break;
    }
  }
  return { images, pathOps };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
