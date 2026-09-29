import { z } from "zod";

/**
 * مخطط القوائم المرجعية (gold) التي تُعدّ يدوياً لكل كراسة.
 * تُستخدم في المرحلة 2 لقياس نسبة التقاط المتطلبات الإلزامية.
 * نفس تصنيفات مصفوفة الامتثال في المنتج.
 */
export const CATEGORIES = ["regulatory", "administrative", "technical", "financial", "local_content", "quality_safety"] as const;

export const GoldRequirement = z.object({
  /** معرّف ثابت داخل الملف: G-001 ... */
  id: z.string().regex(/^G-\d{3,}$/),
  category: z.enum(CATEGORIES),
  /** صياغة المتطلب كما يفهمه المُعِد (مختصرة) */
  text: z.string().min(5),
  /** اسم ملف المصدر كما في meta.json (للكراسات متعددة الملفات) */
  file: z.string().min(1),
  page: z.number().int().positive(),
  section_ref: z.string().nullable().default(null),
  /** اقتباس حرفي من الكراسة — يجب أن يطابق نص الصفحة (يُتحقق منه آلياً في المرحلة 2) */
  quote: z.string().min(10),
  obligation: z.enum(["mandatory", "preferred"]),
  /** هل غيابه يستبعد العرض؟ */
  disqualifying: z.boolean(),
  evidence_required: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});

export const GoldFile = z.object({
  schema_version: z.literal(1),
  requirements: z.array(GoldRequirement),
}).superRefine((g, ctx) => {
  const seen = new Set<string>();
  g.requirements.forEach((r, i) => {
    if (seen.has(r.id)) ctx.addIssue({ code: "custom", path: ["requirements", i, "id"], message: `duplicate id ${r.id}` });
    seen.add(r.id);
  });
});

export const TenderMeta = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(3),
  agency: z.string().nullable().default(null),
  reference_number: z.string().nullable().default(null),
  /** ملفات المصدر مع بصمتها لضمان أن التقييم يجري على نفس النسخة */
  files: z.array(z.object({
    name: z.string(),
    role: z.enum(["booklet", "annex", "boq", "other"]),
    sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable().default(null),
    pages: z.number().int().positive().nullable().default(null),
    scan_type: z.enum(["text", "scanned", "mixed"]).nullable().default(null),
  })).min(1),
  prepared_by: z.string().nullable().default(null),
  prepared_at: z.string().nullable().default(null),
  /** هل راجع شخص ثانٍ القائمة؟ القوائم غير المراجعة تُعرض منفصلة في النتائج */
  reviewed: z.boolean().default(false),
});

export type GoldRequirement = z.infer<typeof GoldRequirement>;
export type TenderMeta = z.infer<typeof TenderMeta>;
