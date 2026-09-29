import { normalizeText } from "./normalize";

/**
 * استخراج كل الأرقام والنسب والمبالغ والتواريخ من نص، بصيغة قانونية قابلة للمقارنة:
 *  - أرقام بالأرقام (لاتينية أو هندية): "1,500" = "1500"، "2.50" = "2.5"، "05" = "5".
 *    التاريخ "1446/05/12" ← 1446 و5 و12. علامة % تُهمل لأن موضعها يتبدّل في النص العربي.
 *  - أرقام بالحروف: "ستة وثلاثون" ← 36، "عشر سنوات" ← 10، "ثلاثة آلاف" ← 3000.
 * النتيجة مصفوفة مرتبة (multiset) لمقارنة "تطابق الأرقام تماماً".
 */

const UNITS: Record<string, number> = {
  واحد: 1, واحده: 1, احد: 1, احدي: 1,
  اثنان: 2, اثنين: 2, اثنتان: 2, اثنتين: 2, اثنا: 2, اثنتا: 2,
  ثلاث: 3, ثلاثه: 3, اربع: 4, اربعه: 4, خمس: 5, خمسه: 5, ست: 6, سته: 6,
  سبع: 7, سبعه: 7, ثمان: 8, ثماني: 8, ثمانيه: 8, تسع: 9, تسعه: 9,
  عشر: 10, عشره: 10,
  عشرون: 20, عشرين: 20, ثلاثون: 30, ثلاثين: 30, اربعون: 40, اربعين: 40, خمسون: 50, خمسين: 50,
  ستون: 60, ستين: 60, سبعون: 70, سبعين: 70, ثمانون: 80, ثمانين: 80, تسعون: 90, تسعين: 90,
  مائه: 100, مئه: 100, مائتان: 200, مائتين: 200, مئتان: 200, مئتين: 200,
  ثلاثمائه: 300, اربعمائه: 400, خمسمائه: 500, ستمائه: 600, سبعمائه: 700, ثمانمائه: 800, تسعمائه: 900,
};
const HUNDRED = new Set(["مائه", "مئه"]);
const THOUSAND: Record<string, number> = { الف: 1000, الاف: 1000, الفا: 1000, الفان: 2000, الفين: 2000 };

function canonicalDigits(token: string): string | null {
  let t = token;
  // فواصل الآلاف: 1,500 أو 1,500,000
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
  t = t.replace(/,/g, ".");
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

function wordNumbers(norm: string): number[] {
  const out: number[] = [];
  let current = 0;
  let total = 0;
  let active = false;
  const flush = () => {
    if (active && total + current > 0) out.push(total + current);
    current = 0;
    total = 0;
    active = false;
  };
  for (const raw of norm.split(" ")) {
    // "و" العطف ملتصقة: "وثلاثون"
    const w = raw.length > 2 && raw.startsWith("و") && (UNITS[raw.slice(1)] !== undefined || THOUSAND[raw.slice(1)] !== undefined) ? raw.slice(1) : raw;
    if (HUNDRED.has(w) && active && current > 0 && current < 10) {
      current *= 100; // "ثلاث مائه"
    } else if (UNITS[w] !== undefined) {
      current += UNITS[w];
      active = true;
    } else if (THOUSAND[w] !== undefined) {
      total += (current || 1) * THOUSAND[w];
      current = 0;
      active = true;
    } else if (w === "و" && active) {
      continue;
    } else {
      flush();
    }
  }
  flush();
  return out;
}

export function extractNumbers(text: string): string[] {
  if (!text) return [];
  const norm = normalizeText(text.replace(/(\d)[,٬](\d{3})/g, "$1$2").replace(/(\d)[.٫](\d)/g, "$1DOT$2"));
  const out: string[] = [];
  for (const m of norm.matchAll(/\d+(?:dot\d+)?/g)) {
    const c = canonicalDigits(m[0].replace("dot", "."));
    if (c !== null) out.push(c);
  }
  for (const n of wordNumbers(norm)) out.push(String(n));
  return out.sort();
}

/** هل كل أرقام a موجودة في b (مع التكرار)؟ */
export function numbersSubset(a: string[], b: string[]): boolean {
  const pool = new Map<string, number>();
  for (const x of b) pool.set(x, (pool.get(x) ?? 0) + 1);
  for (const x of a) {
    const n = pool.get(x) ?? 0;
    if (!n) return false;
    pool.set(x, n - 1);
  }
  return true;
}

export const numbersEqual = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
