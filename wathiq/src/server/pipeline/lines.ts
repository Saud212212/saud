import type { BBox, PageContent, Word } from "./types";

/**
 * إعادة بناء الأسطر والكلمات من قطع نصية متموضعة (من طبقة نص PDF أو من OCR).
 *
 * لماذا: كثير من ملفات PDF العربية (خصوصاً المطبوعة من المتصفح أو بعض برامج التصميم)
 * تخزّن الحروف بالترتيب البصري (يسار→يمين) وبأشكال العرض (Presentation Forms).
 * لذلك لا نعتمد على ترتيب المحتوى في الملف، بل نرتّب بالإحداثيات الفعلية:
 *  - نجمع القطع في أسطر حسب خط القاعدة.
 *  - نحدد اتجاه السطر من غالبية الحروف القوية.
 *  - نرتب القطع يمين→يسار للأسطر العربية، مع إبقاء المقاطع اللاتينية/الأرقام بترتيبها.
 *  - نطبّق NFKC لتحويل أشكال العرض إلى الحروف الأساسية.
 */

export interface Fragment {
  /** النص بالترتيب المنطقي داخل القطعة */
  str: string;
  x0: number;
  x1: number;
  /** خط القاعدة (y للأسفل) */
  baseline: number;
  /** ارتفاع الخط */
  size: number;
  dir: "rtl" | "ltr";
  /** ثقة OCR لكل حرف في هذه القطعة (اختياري) */
  conf?: number;
  /** القطعة كلمة كاملة (OCR): تُفصل دائماً بمسافة عن جاراتها */
  isWord?: boolean;
}

interface Glyph {
  ch: string;
  b: BBox;
  conf?: number;
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN_OR_DIGIT = /[A-Za-z0-9À-ɏ]/;
const BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩؜﻿]/g;

export function fragmentDir(s: string): "rtl" | "ltr" | "neutral" {
  let r = 0;
  let l = 0;
  for (const ch of s) {
    if (ARABIC.test(ch)) r++;
    else if (LATIN_OR_DIGIT.test(ch)) l++;
  }
  if (r === 0 && l === 0) return "neutral";
  return r >= l ? "rtl" : "ltr";
}

function glyphsOf(f: Fragment): Glyph[] {
  const chars = Array.from(f.str.replace(BIDI_CONTROLS, ""));
  if (!chars.length) return [];
  const top = f.baseline - f.size * 0.85;
  const bottom = f.baseline + f.size * 0.25;
  const cw = (f.x1 - f.x0) / chars.length;
  const out: Glyph[] = [];
  chars.forEach((raw, k) => {
    const [gx0, gx1] =
      f.dir === "rtl" ? [f.x1 - (k + 1) * cw, f.x1 - k * cw] : [f.x0 + k * cw, f.x0 + (k + 1) * cw];
    // NFKC قد يحوّل حرفاً واحداً إلى عدة حروف (مثل ﻻ → لا)؛ كلها ترث نفس المربع.
    for (const ch of raw.normalize("NFKC")) out.push({ ch, b: [gx0, top, gx1, bottom], conf: f.conf });
  });
  return out;
}

/** يجمع القطع في أسطر حسب خط القاعدة. */
function groupLines(frags: Fragment[]): Fragment[][] {
  // المسافات بعرض صفر لا تحمل معلومة (تظهر عند الحروف المركبة مثل "لأ")؛ المسافات تُستنتج هندسياً.
  const sorted = frags
    .filter((f) => f.str.length && !(f.x1 - f.x0 < 0.5 && /^\s+$/.test(f.str)))
    .sort((a, b) => a.baseline - b.baseline);
  const lines: { y: number; size: number; items: Fragment[] }[] = [];
  for (const f of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(f.baseline - last.y) <= Math.max(last.size, f.size) * 0.45) {
      last.items.push(f);
      last.size = Math.max(last.size, f.size);
    } else {
      lines.push({ y: f.baseline, size: f.size, items: [f] });
    }
  }
  return lines.map((l) => l.items);
}

/** يرتّب قطع السطر بترتيب القراءة المنطقي. */
function orderLine(items: Fragment[]): Fragment[] {
  let r = 0;
  let l = 0;
  for (const f of items) {
    for (const ch of f.str) {
      if (ARABIC.test(ch)) r++;
      else if (LATIN_OR_DIGIT.test(ch)) l++;
    }
  }
  // سطر فيه عربية بنسبة معتبرة (ثلث الحروف القوية فأكثر) يُقرأ يمين→يسار؛
  // في الكراسات العربية السطر المختلط ("شهادة ISO 9001") عربي الاتجاه غالباً.
  const rtl = r > 0 && r * 2 >= l;
  // نرتب بالمركز لا بالحافة: علامات التشكيل وجزء الهمزة في "لأ" تأتي بعرض صفر فوق حرف آخر.
  const cx = (f: Fragment) => (f.x0 + f.x1) / 2;
  const byX = [...items].sort((a, b) => (rtl ? cx(b) - cx(a) : cx(a) - cx(b)));

  // داخل سطر عربي: سلاسل القطع اللاتينية/الرقمية المتتالية تُقرأ يسار→يمين، فنعكسها.
  // وداخل سطر لاتيني: سلاسل القطع العربية تُقرأ يمين→يسار.
  const minority = rtl ? "ltr" : "rtl";
  const out: Fragment[] = [];
  let i = 0;
  while (i < byX.length) {
    if (fragmentDir(byX[i].str) !== minority) {
      out.push(byX[i++]);
      continue;
    }
    let j = i;
    let lastStrong = i;
    while (j < byX.length) {
      const d = fragmentDir(byX[j].str);
      if (d === minority) lastStrong = j;
      else if (d !== "neutral") break;
      j++;
    }
    out.push(...byX.slice(i, lastStrong + 1).reverse());
    i = lastStrong + 1;
  }
  return out;
}

/** يبني نص الصفحة وكلماتها من القطع. */
export function buildPageContent(frags: Fragment[]): PageContent {
  const lines = groupLines(frags);
  let text = "";
  const words: Word[] = [];

  for (const lineItems of lines) {
    const ordered = orderLine(lineItems);
    const glyphs: Glyph[] = [];
    let prev: Fragment | undefined; // آخر قطعة "أساسية" (ليست علامة تشكيل أو بعرض صفر)
    for (const f of ordered) {
      const isMark = f.x1 - f.x0 < 0.5 || /^[\p{M}\s]+$/u.test(f.str);
      if (prev && !isMark) {
        // فراغ بصري بين قطعتين دون مسافة صريحة → نضيف مسافة
        const gap = Math.max(f.x0 - prev.x1, prev.x0 - f.x1);
        const hasSpace = /\s$/.test(glyphs[glyphs.length - 1]?.ch ?? " ") || /^\s/.test(f.str);
        if (!hasSpace && ((prev.isWord && f.isWord) || gap > Math.min(prev.size, f.size) * 0.2)) {
          const y0 = Math.min(prev.baseline, f.baseline) - f.size * 0.85;
          glyphs.push({ ch: " ", b: [Math.min(prev.x1, f.x1), y0, Math.max(prev.x0, f.x0), y0 + f.size] });
        }
      }
      glyphs.push(...glyphsOf(f));
      if (!isMark) prev = f;
    }

    // تحويل الحروف إلى كلمات ونص
    let lineText = "";
    let cur: { chars: string; b: BBox; start: number; confSum: number; confN: number } | null = null;
    const flush = () => {
      if (!cur) return;
      const w: Word = { t: cur.chars, o: text.length + cur.start, b: cur.b.map((v) => Math.round(v * 10) / 10) as BBox };
      if (cur.confN) w.c = Math.round(cur.confSum / cur.confN);
      words.push(w);
      cur = null;
    };
    for (const g of glyphs) {
      if (/\s/.test(g.ch)) {
        flush();
        if (lineText.length && !lineText.endsWith(" ")) lineText += " ";
        continue;
      }
      if (!cur) cur = { chars: "", b: [...g.b] as BBox, start: lineText.length, confSum: 0, confN: 0 };
      cur.chars += g.ch;
      cur.b = [Math.min(cur.b[0], g.b[0]), Math.min(cur.b[1], g.b[1]), Math.max(cur.b[2], g.b[2]), Math.max(cur.b[3], g.b[3])];
      if (g.conf !== undefined) {
        cur.confSum += g.conf;
        cur.confN++;
      }
      lineText += g.ch;
    }
    flush();
    lineText = lineText.trimEnd();
    if (!lineText) continue;
    text += lineText + "\n";
  }

  return { text: text.replace(/\n$/, ""), words };
}

/** عدد الحروف والأرقام ذات المعنى. */
export function meaningfulCharCount(text: string): number {
  return (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
}

/**
 * نسبة الحروف "المشوهة": منطقة الاستخدام الخاص، حرف الاستبدال، وحروف Latin-1 الممتدة
 * (علامة شائعة على خط عربي بترميز خاطئ مثل "ÇáÔÑæØ").
 */
export function garbleRatio(text: string): number {
  const chars = Array.from(text.replace(/\s/g, ""));
  if (!chars.length) return 0;
  const bad = chars.filter((c) => /[-�\u0000-\u0008À-ÿ]/.test(c)).length;
  return bad / chars.length;
}
