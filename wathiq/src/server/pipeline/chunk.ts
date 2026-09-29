/**
 * تقسيم نص المستند إلى مقاطع مع حفظ رقم الصفحة ومواضع النص.
 * يفضّل القطع عند بداية البنود المرقّمة (2.1، المادة الثالثة، أولاً:) حتى يبقى كل بند كاملاً
 * في مقطع واحد قدر الإمكان.
 */

export interface ChunkSpan {
  page: number;
  /** موضع البداية والنهاية داخل نص الصفحة */
  start: number;
  end: number;
}

export interface Chunk {
  ordinal: number;
  pageStart: number;
  pageEnd: number;
  sectionRef: string | null;
  heading: string | null;
  text: string;
  spans: ChunkSpan[];
  tokenEstimate: number;
}

export const CHUNK_LIMITS = { minChars: 600, maxChars: 3000, headingFlushChars: 200 };

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٫": ".", "٬": ",",
};
export const latinDigits = (s: string) => s.replace(/[٠-٩۰-۹٫٬]/g, (c) => ARABIC_DIGITS[c] ?? c);

const ORDINALS = "أولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا|ثامنا|تاسعا|عاشرا";
/** عنوان رئيسي: القسم/الباب/الفصل/المادة ... */
const HEADING = /^\s*(?:القسم|الباب|الفصل|المادة|الجزء|الملحق)\s+\S+/u;
/** بداية بند مرقّم */
const CLAUSE = new RegExp(
  String.raw`^\s*(?:\d{1,2}(?:[.\-]\d{1,3}){0,4}[.)\-–]?\s|[(\[]\d{1,2}[)\]]\s|(?:${ORDINALS})[ًٌ]?\s*[:\-–]|(?:البند|المادة)\s+\S+)`,
  "u",
);
const SECTION_REF = /^\s*(\d{1,2}(?:\.\d{1,3}){0,4})(?=[.)\-–]?\s)/;

export function detectSectionRef(line: string): string | null {
  const m = latinDigits(line).match(SECTION_REF);
  return m ? m[1] : null;
}

export function isClauseStart(line: string): boolean {
  const l = latinDigits(line);
  return CLAUSE.test(l) || HEADING.test(l);
}

export const estimateTokens = (text: string) => Math.ceil(text.length / 3);

export function chunkPages(pages: { pageNo: number; text: string }[]): Chunk[] {
  const chunks: Chunk[] = [];
  let buf: { text: string; spans: ChunkSpan[]; ref: string | null; heading: string | null } | null = null;
  let currentRef: string | null = null;
  let currentHeading: string | null = null;

  const flush = () => {
    if (!buf || !buf.text.trim()) {
      buf = null;
      return;
    }
    const pagesIn = buf.spans.map((s) => s.page);
    chunks.push({
      ordinal: chunks.length,
      pageStart: Math.min(...pagesIn),
      pageEnd: Math.max(...pagesIn),
      sectionRef: buf.ref,
      heading: buf.heading,
      text: buf.text.trimEnd(),
      spans: buf.spans,
      tokenEstimate: estimateTokens(buf.text),
    });
    buf = null;
  };

  for (const page of pages) {
    let offset = 0;
    for (const line of page.text.split("\n")) {
      const start = offset;
      offset += line.length + 1;
      if (!line.trim()) continue;

      const heading = HEADING.test(latinDigits(line));
      const clause = heading || isClauseStart(line);
      const size = buf?.text.length ?? 0;
      if (buf && ((heading && size >= CHUNK_LIMITS.headingFlushChars) || (clause && size >= CHUNK_LIMITS.minChars))) flush();
      if (buf && size + line.length > CHUNK_LIMITS.maxChars) flush();

      if (heading) {
        currentHeading = line.trim();
        currentRef = null; // قسم جديد: لا نورّث رقم بند القسم السابق
      }
      const ref = detectSectionRef(line);
      if (ref) currentRef = ref;

      if (!buf) buf = { text: "", spans: [], ref: ref ?? currentRef, heading: currentHeading };
      else if (buf.ref === null && ref) buf.ref = ref; // مقطع يبدأ بعنوان قسم يأخذ رقم أول بند فيه
      buf.text += line + "\n";
      const last = buf.spans[buf.spans.length - 1];
      if (last && last.page === page.pageNo && last.end + 1 >= start) last.end = start + line.length;
      else buf.spans.push({ page: page.pageNo, start, end: start + line.length });
    }
  }
  flush();
  return chunks;
}
