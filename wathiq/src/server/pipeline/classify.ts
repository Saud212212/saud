import type { ClassifiedPage, PageAnalysis } from "./types";

/**
 * تصنيف الصفحات. العتبات مجمّعة هنا لتسهيل ضبطها على كراسات حقيقية.
 */
export const THRESHOLDS = {
  /** أقل من هذا العدد من الحروف ذات المعنى = لا توجد طبقة نص فعلية */
  minTextChars: 40,
  /** صفحة مغطاة بصورة وفيها أقل من هذا = نص عرضي فقط (ختم/تذييل) فوق صورة ممسوحة */
  stampTextChars: 200,
  /** تغطية الصور التي تعني أن الصفحة "صورة" */
  imageCoverage: 0.5,
  /** تغطية صغيرة تكفي لاعتبار صفحة بلا نص ممسوحة وليست فارغة */
  anyImageCoverage: 0.05,
  /** نسبة الحروف المشوّهة التي تعني طبقة نص تالفة */
  garbleRatio: 0.2,
  /** عمليات رسم متجهي كثيرة بلا نص = نص محوّل لمنحنيات */
  vectorTextPathOps: 150,
  /** صورة تتكرر بنفس الأبعاد في هذه النسبة من الصفحات = ترويسة/خلفية وليست مسحاً */
  backgroundRepeatRatio: 0.6,
  backgroundMinPages: 3,
} as const;

/** يكتشف الصور المتكررة (ترويسة الجهة أو خلفية مائية) عبر صفحات المستند. */
export function detectBackgroundSignatures(pages: PageAnalysis[]): Set<string> {
  const out = new Set<string>();
  if (pages.length < THRESHOLDS.backgroundMinPages) return out;
  const counts = new Map<string, number>();
  for (const p of pages) for (const sig of new Set(p.images.map((i) => i.sig))) counts.set(sig, (counts.get(sig) ?? 0) + 1);
  for (const [sig, n] of counts) if (n / pages.length >= THRESHOLDS.backgroundRepeatRatio) out.add(sig);
  // الصور الممسوحة نفسها قد تتكرر بنفس الأبعاد في مستند ممسوح بالكامل! نميّز بوجود طبقة نص:
  // الخلفية تكون تحت نص حقيقي في غالبية الصفحات.
  for (const sig of [...out]) {
    const withSig = pages.filter((p) => p.images.some((i) => i.sig === sig));
    const withText = withSig.filter((p) => p.meaningfulChars >= THRESHOLDS.stampTextChars);
    if (withText.length / withSig.length < 0.5) out.delete(sig);
  }
  return out;
}

export function classifyPage(p: PageAnalysis, background: Set<string>): ClassifiedPage {
  const T = THRESHOLDS;
  const coverage = Math.min(
    1,
    p.images.filter((i) => !background.has(i.sig)).reduce((s, i) => s + i.coverage, 0),
  );
  const base = { ...p, imageCoverage: coverage };

  if (p.meaningfulChars >= T.minTextChars && p.garbleRatio > T.garbleRatio) {
    return { ...base, kind: "broken_text", needsOcr: true, reason: `garble=${p.garbleRatio.toFixed(2)}` };
  }
  if (p.meaningfulChars < T.minTextChars) {
    if (coverage >= T.anyImageCoverage) {
      return { ...base, kind: "scanned", needsOcr: true, reason: `chars=${p.meaningfulChars} images=${coverage.toFixed(2)}` };
    }
    if (p.pathOps >= T.vectorTextPathOps) {
      return { ...base, kind: "scanned", needsOcr: true, reason: `vector-only paths=${p.pathOps}` };
    }
    return { ...base, kind: "blank", needsOcr: false, reason: `chars=${p.meaningfulChars}` };
  }
  if (coverage >= T.imageCoverage && p.meaningfulChars < T.stampTextChars) {
    return { ...base, kind: "scanned", needsOcr: true, reason: `stamp-text chars=${p.meaningfulChars} images=${coverage.toFixed(2)}` };
  }
  if (coverage >= T.imageCoverage) {
    // نص حقيقي + صورة كبيرة قد تحتوي نصاً (ملحق ملصوق). نشغّل OCR ونختار الأغنى.
    return { ...base, kind: "hybrid", needsOcr: true, reason: `chars=${p.meaningfulChars} images=${coverage.toFixed(2)}` };
  }
  return { ...base, kind: "text", needsOcr: false, reason: `chars=${p.meaningfulChars}` };
}
