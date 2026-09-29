import type { BBox, Word } from "../pipeline/types";
import { charSimilarity, normalizeWithMap, type Normalized } from "./normalize";
import { extractNumbers, numbersEqual, numbersSubset } from "./numbers";

/**
 * التحقق البرمجي من كل اقتباس يُرجعه النموذج مقابل نص الصفحة المذكورة.
 *
 * الحالات (من الأقوى للأضعف):
 *  - verified                 : الاقتباس موجود حرفياً (بعد التوحيد) في الصفحة المذكورة، والأرقام متطابقة تماماً.
 *  - verified_corrected_page  : موجود حرفياً لكن في صفحة مجاورة (±2)؛ يُسجَّل رقم الصفحة الصحيح.
 *  - needs_review             : مطابقة تقريبية ≥ 90% (للاقتباسات ≥ 25 حرفاً فقط)، أو أي اختلاف في الأرقام،
 *                               أو أرقام من صفحة OCR ضعيفة الثقة.
 *  - unverified               : لا مطابقة. لا يُعرض كمتطلب مؤكد.
 */

export type VerificationStatus = "verified" | "verified_corrected_page" | "needs_review" | "unverified";

export type ReviewReason =
  | "fuzzy_match" // مطابقة تقريبية وليست حرفية
  | "page_corrected" // الصفحة المذكورة خاطئة
  | "number_mismatch" // أرقام الاقتباس ≠ أرقام النص المطابق
  | "value_numbers_not_in_source" // رقم في القيمة/نص المتطلب غير موجود في المصدر
  | "low_ocr_numbers" // أرقام من صفحة (أو كلمات) OCR ضعيفة الثقة
  | "ocr_numbers" // أرقام من صفحة ممسوحة (سياسة all): الـ OCR يشوّه الأرقام حتى في الصفحات الجيدة
  | "quote_too_short_for_fuzzy" // أقل من 25 حرفاً ولم تُطابَق حرفياً
  | "not_found" // لم يوجد في الصفحة ولا المجاورة
  | "no_source" // النموذج لم يُرفق مصدراً
  | "page_out_of_range"; // رقم صفحة غير موجود في الملف

export const VERIFY_LIMITS = {
  fuzzyThreshold: 0.9,
  minFuzzyChars: 25,
  neighborPages: 2,
  lowWordConfidence: 60,
} as const;

export interface PageForVerify {
  text: string;
  words: Word[];
  lowConfidence: boolean;
  /** النص من التعرّف الضوئي (لا من طبقة نص) */
  ocr?: boolean;
}

/**
 * سياسة أرقام صفحات OCR:
 *  - low: فقط الصفحات/الكلمات ضعيفة الثقة (الحد الأدنى المطلوب).
 *  - all (الافتراضي): أي رقم من صفحة ممسوحة. سبب: في صفحة بثقة 91% قُرئت "2%" على أنها "962"
 *    فطابق الاقتباس النص المشوّه حرفياً وظهر «موثّقاً».
 */
export type OcrNumbersPolicy = "all" | "low";

export interface HighlightRect {
  page: number;
  b: BBox;
}

export interface VerificationResult {
  status: VerificationStatus;
  reasons: ReviewReason[];
  /** الصفحة التي وُجد فيها الاقتباس فعلاً */
  matchedPage: number | null;
  similarity: number;
  /** النص الأصلي المطابق في الصفحة (قد يختلف عن الاقتباس في المطابقة التقريبية) */
  matchedText: string | null;
  rects: HighlightRect[];
  quoteNumbers: string[];
  matchedNumbers: string[];
}

const RANK: Record<VerificationStatus, number> = { verified: 0, verified_corrected_page: 1, needs_review: 2, unverified: 3 };
export const worseStatus = (a: VerificationStatus, b: VerificationStatus) => (RANK[a] >= RANK[b] ? a : b);

/** ذاكرة توحيد الصفحات: الصفحة الواحدة يُتحقق فيها من عشرات الاقتباسات. */
export class PageIndex {
  private cache = new Map<number, Normalized>();
  constructor(readonly pages: Map<number, PageForVerify>) {}
  norm(page: number): Normalized | undefined {
    const p = this.pages.get(page);
    if (!p) return undefined;
    let n = this.cache.get(page);
    if (!n) {
      n = normalizeWithMap(p.text);
      this.cache.set(page, n);
    }
    return n;
  }
}

interface Span {
  page: number;
  /** موضع في النص الأصلي للصفحة [start, end) */
  start: number;
  end: number;
}

interface Match {
  spans: Span[];
  similarity: number;
  exact: boolean;
}

function candidatePages(stated: number, index: PageIndex): number[] {
  const out = [stated];
  for (let d = 1; d <= VERIFY_LIMITS.neighborPages; d++) out.push(stated - d, stated + d);
  return out.filter((p) => index.pages.has(p));
}

function toSpan(page: number, n: Normalized, text: string, from: number, to: number): Span {
  const start = n.map[from];
  const end = to < n.map.length ? n.map[to] : text.length;
  return { page, start, end: Math.max(start + 1, end) };
}

/** أول ظهور على حدود كلمات (لا يُقبل "الزكا" داخل "الزكاه": الكلمة المبتورة تعديل على المصدر). */
function indexOfWord(hay: string, needle: string, from = 0): number {
  for (let at = hay.indexOf(needle, from); at >= 0; at = hay.indexOf(needle, at + 1)) {
    const before = at === 0 || hay[at - 1] === " ";
    const after = at + needle.length === hay.length || hay[at + needle.length] === " ";
    if (before && after) return at;
  }
  return -1;
}

function exactMatch(qn: string, page: number, index: PageIndex): Match | null {
  const n = index.norm(page)!;
  const text = index.pages.get(page)!.text;
  const at = indexOfWord(n.norm, qn);
  if (at >= 0) return { spans: [toSpan(page, n, text, at, at + qn.length)], similarity: 1, exact: true };
  // اقتباس يمتد عبر نهاية الصفحة وبداية التالية
  const next = index.norm(page + 1);
  if (next) {
    const joined = `${n.norm} ${next.norm}`;
    let j = indexOfWord(joined, qn);
    while (j >= 0 && !(j < n.norm.length && j + qn.length > n.norm.length)) j = indexOfWord(joined, qn, j + 1);
    if (j >= 0) {
      const nextText = index.pages.get(page + 1)!.text;
      return {
        spans: [
          toSpan(page, n, text, j, n.norm.length),
          toSpan(page + 1, next, nextText, 0, j + qn.length - n.norm.length - 1),
        ],
        similarity: 1,
        exact: true,
      };
    }
  }
  return null;
}

/** أفضل نافذة كلمات تقريبية: ترشيح بتداخل الكلمات ثم مقارنة حرفية للأفضل فقط. */
function fuzzyMatch(qn: string, page: number, index: PageIndex): Match | null {
  const n = index.norm(page)!;
  const text = index.pages.get(page)!.text;
  const qTokens = qn.split(" ");
  const pTokens: { t: string; start: number; end: number }[] = [];
  const re = /\S+/g;
  for (let m = re.exec(n.norm); m; m = re.exec(n.norm)) pTokens.push({ t: m[0], start: m.index, end: m.index + m[0].length });
  if (!pTokens.length) return null;

  const qSet = new Map<string, number>();
  for (const t of qTokens) qSet.set(t, (qSet.get(t) ?? 0) + 1);
  const L = qTokens.length;
  const scored: { i: number; s: number }[] = [];
  for (let i = 0; i + Math.min(L, pTokens.length) <= pTokens.length; i++) {
    const seen = new Map<string, number>();
    let s = 0;
    for (let k = i; k < Math.min(i + L, pTokens.length); k++) {
      const t = pTokens[k].t;
      const used = seen.get(t) ?? 0;
      if (used < (qSet.get(t) ?? 0)) s++;
      seen.set(t, used + 1);
    }
    scored.push({ i, s });
  }
  scored.sort((a, b) => b.s - a.s);

  let best: { sim: number; from: number; to: number } | null = null;
  for (const { i } of scored.slice(0, 6)) {
    for (let len = Math.max(1, L - 2); len <= L + 2; len++) {
      const j = Math.min(pTokens.length, i + len) - 1;
      for (const start of [i, Math.max(0, i - 1)]) {
        const cand = n.norm.slice(pTokens[start].start, pTokens[j].end);
        const sim = charSimilarity(qn, cand);
        if (!best || sim > best.sim) best = { sim, from: pTokens[start].start, to: pTokens[j].end };
      }
    }
  }
  if (!best) return null;
  return { spans: [toSpan(page, n, text, best.from, best.to)], similarity: best.sim, exact: false };
}

function rectsFor(spans: Span[], index: PageIndex): HighlightRect[] {
  const out: HighlightRect[] = [];
  for (const s of spans) {
    const words = index.pages.get(s.page)!.words.filter((w) => w.o < s.end && w.o + w.t.length > s.start);
    // دمج كلمات السطر الواحد في مستطيل واحد
    const lines: BBox[] = [];
    for (const w of words) {
      const line = lines.find((l) => Math.abs(l[1] - w.b[1]) < (w.b[3] - w.b[1]) * 0.6);
      if (line) {
        line[0] = Math.min(line[0], w.b[0]);
        line[1] = Math.min(line[1], w.b[1]);
        line[2] = Math.max(line[2], w.b[2]);
        line[3] = Math.max(line[3], w.b[3]);
      } else lines.push([...w.b] as BBox);
    }
    for (const b of lines) out.push({ page: s.page, b });
  }
  return out;
}

export interface VerifyInput {
  quote: string | null | undefined;
  page: number | null | undefined;
  /** قيم استخرجها النموذج ويجب أن تكون أرقامها موجودة في المصدر (قيمة الحقل، نص المتطلب...) */
  claims?: (string | null | undefined)[];
}

export function verifyQuote(input: VerifyInput, index: PageIndex, opts: { ocrNumbers?: OcrNumbersPolicy } = {}): VerificationResult {
  const ocrPolicy = opts.ocrNumbers ?? "all";
  const base = { matchedPage: null, similarity: 0, matchedText: null, rects: [], matchedNumbers: [] };
  const quote = (input.quote ?? "").trim();
  const quoteNumbers = extractNumbers(quote);
  if (!quote || !input.page) return { ...base, status: "unverified", reasons: ["no_source"], quoteNumbers };
  const stated = Math.trunc(Number(input.page));
  const qn = normalizeWithMap(quote).norm;
  if (!qn) return { ...base, status: "unverified", reasons: ["no_source"], quoteNumbers };
  const pages = candidatePages(stated, index);
  if (!pages.length) return { ...base, status: "unverified", reasons: ["page_out_of_range"], quoteNumbers };

  let match: Match | null = null;
  let matchedPage: number | null = null;
  for (const p of pages) {
    match = exactMatch(qn, p, index);
    if (match) {
      matchedPage = p;
      break;
    }
  }
  const reasons: ReviewReason[] = [];
  if (!match) {
    if (qn.length < VERIFY_LIMITS.minFuzzyChars) {
      return { ...base, status: "unverified", reasons: ["quote_too_short_for_fuzzy"], quoteNumbers };
    }
    let best: Match | null = null;
    let bestPage: number | null = null;
    for (const p of pages) {
      const m = fuzzyMatch(qn, p, index);
      // عند التعادل تُفضَّل الصفحة المذكورة (أول القائمة)
      if (m && (!best || m.similarity > best.similarity + 1e-9)) {
        best = m;
        bestPage = p;
      }
    }
    if (!best || best.similarity < VERIFY_LIMITS.fuzzyThreshold) {
      return { ...base, similarity: best?.similarity ?? 0, status: "unverified", reasons: ["not_found"], quoteNumbers };
    }
    match = best;
    matchedPage = bestPage;
    reasons.push("fuzzy_match");
  }

  let status: VerificationStatus = matchedPage === stated ? "verified" : "verified_corrected_page";
  if (matchedPage !== stated) reasons.push("page_corrected");
  if (!match.exact) status = "needs_review";

  const matchedText = match.spans.map((s) => index.pages.get(s.page)!.text.slice(s.start, s.end)).join(" ");
  const matchedNumbers = extractNumbers(matchedText);

  // «موثّق» يتطلب تطابق الأرقام تماماً
  if (!numbersEqual(quoteNumbers, matchedNumbers)) {
    status = worseStatus(status, "needs_review");
    reasons.push("number_mismatch");
  }
  // أرقام القيم المستخرجة يجب أن تكون في المصدر نفسه
  const claimNumbers = (input.claims ?? []).flatMap((c) => extractNumbers(c ?? ""));
  if (!numbersSubset(claimNumbers, [...matchedNumbers])) {
    status = worseStatus(status, "needs_review");
    reasons.push("value_numbers_not_in_source");
  }
  // صفحات OCR ضعيفة الثقة: كل رقم منها يحتاج مراجعة
  const hasNumbers = quoteNumbers.length + matchedNumbers.length + claimNumbers.length > 0;
  const lowPage = match.spans.some((s) => index.pages.get(s.page)!.lowConfidence);
  const lowDigitWord = match.spans.some((s) =>
    index.pages
      .get(s.page)!
      .words.some((w) => w.o < s.end && w.o + w.t.length > s.start && /\d|[٠-٩]/.test(w.t) && w.c !== undefined && w.c < VERIFY_LIMITS.lowWordConfidence),
  );
  if (hasNumbers && (lowPage || lowDigitWord)) {
    status = worseStatus(status, "needs_review");
    reasons.push("low_ocr_numbers");
  } else if (hasNumbers && ocrPolicy === "all" && match.spans.some((s) => index.pages.get(s.page)!.ocr)) {
    status = worseStatus(status, "needs_review");
    reasons.push("ocr_numbers");
  }

  return {
    status,
    reasons,
    matchedPage,
    similarity: Math.round(match.similarity * 1000) / 1000,
    matchedText,
    rects: rectsFor(match.spans, index),
    quoteNumbers,
    matchedNumbers,
  };
}
