/**
 * توحيد النص العربي للمطابقة، مع خريطة من كل حرف في النص الموحّد إلى موضعه في النص الأصلي
 * (لنعرف أي كلمات الصفحة طابقها الاقتباس فنظلّلها).
 *
 * التوحيد: NFKC (أشكال العرض)، حذف التشكيل والتطويل وعلامات الاتجاه، توحيد الهمزات (أ إ آ ٱ ← ا،
 * ؤ ← و، ئ ← ي)، ى ← ي، ة ← ه، الأرقام الهندية ← لاتينية، الحروف اللاتينية صغيرة،
 * وكل ما عدا الحروف والأرقام و% يصبح مسافة، ثم ضغط المسافات.
 */

const DROP = /[ً-ٰٟـۖ-ۭ​-‏‪-‮⁦-⁩؜﻿]/;
const MAP: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
  "ؤ": "و", "ئ": "ي", "ى": "ي", "ة": "ه",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٪": "%",
};
const KEEP = /[\p{L}\p{N}%]/u;

export interface Normalized {
  norm: string;
  /** map[i] = موضع الحرف i من norm في النص الأصلي */
  map: number[];
}

export function normalizeWithMap(input: string): Normalized {
  let norm = "";
  const map: number[] = [];
  let pendingSpace = false;
  let idx = 0;
  for (const raw of input) {
    const at = idx;
    idx += raw.length;
    for (let ch of raw.normalize("NFKC")) {
      if (DROP.test(ch)) continue;
      ch = MAP[ch] ?? ch.toLowerCase();
      if (!KEEP.test(ch)) {
        pendingSpace = norm.length > 0;
        continue;
      }
      if (pendingSpace) {
        norm += " ";
        map.push(at);
        pendingSpace = false;
      }
      norm += ch;
      map.push(at);
    }
  }
  return { norm, map };
}

export const normalizeText = (s: string) => normalizeWithMap(s).norm;

/** نسبة التشابه على مستوى الحروف (1 − مسافة ليفنشتاين / الطول الأكبر). */
export function charSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

/** تشابه Jaccard بين مجموعتي الكلمات. */
export function tokenJaccard(a: string, b: string): number {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
