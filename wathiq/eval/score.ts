/**
 * حساب مقاييس الاستخراج مقابل قائمة مرجعية (دالة نقية بلا قاعدة بيانات أو نموذج).
 *
 * المطابقة (مرجعي ↔ مستخرج):
 *   نفس الملف + فرق الصفحة ≤ 1 + (تداخل كلمات الاقتباس ≥ 60% من الأقصر، أو تشابه النص ≥ 50%).
 *   المطابقة متعددة إلى واحد: متطلب مستخرج واحد قد يغطي أكثر من عنصر مرجعي (والعكس).
 *
 * المقاييس الأساسية:
 *   mandatoryRecall  = عناصر مرجعية إلزامية التقطها النظام (معروضة: ليست "غير موثّق") ÷ كل الإلزامية
 *   inventedRate     = متطلبات معروضة بلا أي مقابل مرجعي ÷ كل المعروضة
 *   fabricatedRate   = عناصر اقتباسها غير موجود في الكراسة (غير موثّق) ÷ كل ما أعاده النموذج
 * العناصر "المخترعة" قد تكون أيضاً نقصاً في القائمة المرجعية: تُسرد بالتفصيل للمراجعة اليدوية.
 */
import { normalizeText, tokenJaccard } from "../src/server/analysis/normalize";
import type { GoldRequirement } from "./schema";

export interface ExtractedForEval {
  code: string;
  fileName: string | null;
  page: number | null;
  text: string;
  quote: string | null;
  matchedText: string | null;
  obligation: string | null;
  category: string | null;
  disqualifying: boolean;
  verification: "verified" | "verified_corrected_page" | "needs_review" | "unverified";
}

export const MATCH = { pageTolerance: 1, quoteContainment: 0.6, textJaccard: 0.5 } as const;

const tokens = (s: string | null | undefined) => new Set(normalizeText(s ?? "").split(" ").filter((t) => t.length > 1));

function containment(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

export function matchScore(g: GoldRequirement, e: ExtractedForEval): number {
  if (e.fileName !== g.file) return 0;
  if (e.page === null || Math.abs(e.page - g.page) > MATCH.pageTolerance) return 0;
  const gq = tokens(g.quote);
  const eq = new Set([...tokens(e.quote), ...tokens(e.matchedText)]);
  const q = containment(gq, eq);
  const t = tokenJaccard(normalizeText(g.text), normalizeText(e.text));
  const s = Math.max(q >= MATCH.quoteContainment ? q : 0, t >= MATCH.textJaccard ? t : 0);
  return s;
}

const ratio = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 1000) / 1000);

export interface ScoreReport {
  counts: {
    gold: number;
    goldMandatory: number;
    goldDisqualifying: number;
    extracted: number;
    extractedShown: number;
    extractedUnverified: number;
  };
  metrics: {
    mandatoryRecall: number | null;
    disqualifyingRecall: number | null;
    overallRecall: number | null;
    inventedRate: number | null;
    fabricatedRate: number | null;
    precision: number | null;
    obligationAgreement: number | null;
    disqualifyingAgreement: number | null;
    categoryAgreement: number | null;
  };
  /** العناصر الإلزامية المرجعية الفائتة — أهم ما يُراجع */
  missedMandatory: { id: string; page: number; text: string; nearestUnverified: string | null }[];
  missedOther: { id: string; page: number; text: string }[];
  /** معروضة بلا مقابل مرجعي (مخترعة أو نقص في القائمة المرجعية) */
  unmatchedExtracted: { code: string; page: number | null; text: string; verification: string }[];
  fabricated: { code: string; page: number | null; text: string; quote: string | null }[];
  matches: { goldId: string; code: string; score: number }[];
}

export function scoreTender(gold: GoldRequirement[], extracted: ExtractedForEval[]): ScoreReport {
  const shown = extracted.filter((e) => e.verification !== "unverified");
  const unverified = extracted.filter((e) => e.verification === "unverified");
  const matches: ScoreReport["matches"] = [];
  const bestFor = new Map<string, { e: ExtractedForEval; score: number }>();
  const matchedCodes = new Set<string>();

  for (const g of gold) {
    for (const e of shown) {
      const score = matchScore(g, e);
      if (score <= 0) continue;
      matches.push({ goldId: g.id, code: e.code, score: Math.round(score * 1000) / 1000 });
      matchedCodes.add(e.code);
      const cur = bestFor.get(g.id);
      if (!cur || score > cur.score) bestFor.set(g.id, { e, score });
    }
  }

  const mandatory = gold.filter((g) => g.obligation === "mandatory");
  const disq = gold.filter((g) => g.disqualifying);
  const captured = (list: GoldRequirement[]) => list.filter((g) => bestFor.has(g.id)).length;
  const pairs = gold.filter((g) => bestFor.has(g.id)).map((g) => ({ g, e: bestFor.get(g.id)!.e }));
  const agree = (f: (p: (typeof pairs)[number]) => boolean) => ratio(pairs.filter(f).length, pairs.length);
  const unmatched = shown.filter((e) => !matchedCodes.has(e.code));

  return {
    counts: {
      gold: gold.length,
      goldMandatory: mandatory.length,
      goldDisqualifying: disq.length,
      extracted: extracted.length,
      extractedShown: shown.length,
      extractedUnverified: unverified.length,
    },
    metrics: {
      mandatoryRecall: ratio(captured(mandatory), mandatory.length),
      disqualifyingRecall: ratio(captured(disq), disq.length),
      overallRecall: ratio(captured(gold), gold.length),
      inventedRate: ratio(unmatched.length, shown.length),
      fabricatedRate: ratio(unverified.length, extracted.length),
      precision: ratio(shown.length - unmatched.length, shown.length),
      obligationAgreement: agree(({ g, e }) => g.obligation === e.obligation),
      disqualifyingAgreement: agree(({ g, e }) => g.disqualifying === e.disqualifying),
      categoryAgreement: agree(({ g, e }) => g.category === e.category),
    },
    missedMandatory: mandatory
      .filter((g) => !bestFor.has(g.id))
      .map((g) => ({
        id: g.id,
        page: g.page,
        text: g.text,
        // هل التقطه النموذج لكن اقتباسه لم يُتحقق منه؟ (يفرّق بين "لم يره" و"رآه ورفضه التحقق")
        nearestUnverified: unverified.find((u) => matchScore(g, { ...u, verification: "verified" }) > 0)?.code ?? null,
      })),
    missedOther: gold.filter((g) => g.obligation !== "mandatory" && !bestFor.has(g.id)).map((g) => ({ id: g.id, page: g.page, text: g.text })),
    unmatchedExtracted: unmatched.map((e) => ({ code: e.code, page: e.page, text: e.text, verification: e.verification })),
    fabricated: unverified.map((e) => ({ code: e.code, page: e.page, text: e.text, quote: e.quote })),
    matches,
  };
}
