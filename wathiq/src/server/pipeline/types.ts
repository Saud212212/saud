/** مربع بإحداثيات نقاط PDF (1/72 بوصة)، الأصل أعلى يسار الصفحة بعد تطبيق الدوران. */
export type BBox = [x0: number, y0: number, x1: number, y1: number];

/** كلمة: النص، موضعها في نص الصفحة (offset)، مربعها، وثقة OCR إن وُجدت. */
export interface Word {
  t: string;
  o: number;
  b: BBox;
  c?: number;
}

/** المحتوى المشفّر لكل صفحة (document_pages.content_enc). */
export interface PageContent {
  text: string;
  words: Word[];
}

export type PageKind = "text" | "scanned" | "hybrid" | "broken_text" | "blank";
export type TextSource = "text_layer" | "ocr" | "none";

export interface PageAnalysis {
  pageNo: number;
  width: number;
  height: number;
  rotation: number;
  content: PageContent;
  meaningfulChars: number;
  garbleRatio: number;
  imageCoverage: number;
  pathOps: number;
  /** توقيعات الصور (عرض×ارتفاع البكسل) ومساحتها النسبية — لكشف خلفيات الترويسة المتكررة */
  images: { sig: string; coverage: number }[];
}

export interface ClassifiedPage extends PageAnalysis {
  kind: PageKind;
  needsOcr: boolean;
  /** سبب التصنيف — يُعرض للمستخدم ويساعد في ضبط العتبات */
  reason: string;
}
