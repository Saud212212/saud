import { z } from "zod";

/**
 * مخطط مخرجات برومت extract.md. متسامح في الشكل (النماذج تختلف في التفاصيل الصغيرة:
 * رقم صفحة كنص، مصدر فارغ {}، حقل مفقود) وصارم في المضمون: كل عنصر بلا مصدر
 * يُنقل لقائمة "غير موثّق" في الكود ولا يُحذف بصمت.
 */

const str = z
  .union([z.string(), z.number(), z.boolean()])
  .nullish()
  .transform((v) => (v === null || v === undefined || v === "" ? null : String(v).trim() || null));

export const Source = z
  .object({
    page: z.union([z.number(), z.string()]).nullish(),
    clause: str,
    quote: str,
  })
  .partial()
  .nullish()
  .transform((s) => {
    const page = s?.page === undefined || s?.page === null ? null : Number(String(s.page).replace(/[^\d]/g, "")) || null;
    return { page, clause: s?.clause ?? null, quote: s?.quote ?? null };
  });
export type Source = z.output<typeof Source>;

export const CATEGORY_MAP = {
  نظامي: "regulatory",
  إداري: "administrative",
  فني: "technical",
  مالي: "financial",
  "محتوى محلي": "local_content",
  جودة: "quality",
  سلامة: "safety",
  تشغيل: "operations",
} as const;
export type Category = (typeof CATEGORY_MAP)[keyof typeof CATEGORY_MAP];
export const CATEGORIES = Object.values(CATEGORY_MAP) as Category[];

export const OBLIGATION_MAP = { إلزامي: "mandatory", تفضيلي: "preferred", معلوماتي: "informational" } as const;
export type Obligation = (typeof OBLIGATION_MAP)[keyof typeof OBLIGATION_MAP];

const norm = (s: string) => s.replace(/[ً-ٟـ]/g, "").replace(/[أإآ]/g, "ا").trim();
function mapEnum<T extends string>(m: Record<string, T>, v: unknown): T | null {
  if (typeof v !== "string") return null;
  const hit = Object.entries(m).find(([k, val]) => norm(k) === norm(v) || val === v.trim());
  return hit ? hit[1] : null;
}

const Requirement = z.object({
  local_id: str,
  category: z.unknown().transform((v) => ({ raw: typeof v === "string" ? v : null, value: mapEnum<Category>(CATEGORY_MAP, v) })),
  text: str,
  obligation: z.unknown().transform((v) => mapEnum<Obligation>(OBLIGATION_MAP, v)),
  disqualifying_if_missing: z
    .union([z.boolean(), z.string()])
    .nullish()
    .transform((v) => v === true || v === "true"),
  evidence_required: str,
  source: Source,
});
export type ExtractedRequirement = z.output<typeof Requirement>;

const Criterion = z.object({
  name: str,
  weight: str,
  sub_criteria: z.array(z.unknown()).nullish().transform((a) => (a ?? []).map((x) => (typeof x === "string" ? x : JSON.stringify(x)))),
  source: Source,
});

const arr = <T extends z.ZodTypeAny>(t: T) => z.array(t).nullish().transform((a) => a ?? []);
const withSource = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, source: Source });

export const ExtractOutput = z.object({
  tender_summary: z
    .object({
      entity: str,
      tender_number: str,
      title: str,
      type: str,
      booklet_price: str,
      initial_guarantee: str,
      final_guarantee: str,
      duration: str,
      location: str,
      dates: z
        .object({ inquiries_deadline: str, submission_deadline: str, opening_date: str, calendar: str })
        .partial()
        .nullish()
        .transform((d) => d ?? {}),
      evaluation: z
        .object({ technical_weight: str, financial_weight: str, min_technical_score: str, criteria: arr(Criterion) })
        .partial()
        .nullish()
        .transform((e) => ({ ...e, criteria: e?.criteria ?? [] })),
      local_content: z
        .object({
          requirements: str,
          mandatory_list_items: arr(z.unknown()).transform((a) => a.map((x) => (typeof x === "string" ? x : JSON.stringify(x)))),
          sme_preference: str,
          source: Source,
        })
        .partial()
        .nullish()
        .transform((l) => l ?? {}),
    })
    .partial()
    .nullish()
    .transform((t) => t ?? {}),
  field_sources: z.record(z.string(), Source).nullish().transform((f) => f ?? {}),
  requirements: arr(Requirement),
  staffing_requirements: arr(withSource({ role: str, count: str, qualifications: str, min_experience_years: str, saudi_required: str })),
  deliverables: arr(withSource({ item: str, deadline: str })),
  technical_offer_required_contents: arr(withSource({ item: str })),
  risks_and_ambiguities: arr(withSource({ issue: str, impact: str, suggested_inquiry: str })),
  verify_notes: arr(z.unknown()).transform((a) => a.map((x) => (typeof x === "string" ? x : JSON.stringify(x)))),
});
export type ExtractOutput = z.output<typeof ExtractOutput>;

/** حقول الملخص القياسية (مسارها في tender_summary) */
export const SUMMARY_FIELDS = [
  "entity",
  "tender_number",
  "title",
  "type",
  "booklet_price",
  "initial_guarantee",
  "final_guarantee",
  "duration",
  "location",
  "dates.inquiries_deadline",
  "dates.submission_deadline",
  "dates.opening_date",
  "evaluation.technical_weight",
  "evaluation.financial_weight",
  "evaluation.min_technical_score",
  "local_content.requirements",
  "local_content.sme_preference",
] as const;
export type SummaryField = (typeof SUMMARY_FIELDS)[number];

/** يستخرج أول كائن JSON من نص (يتسامح مع ```json والنص المحيط). */
export function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in model output");
  return JSON.parse(body.slice(start, end + 1));
}
