import type { LlmProvider, LlmRequest, LlmResponse } from "@/server/ai/provider";

/**
 * نموذج مُبرمَج للاختبارات: يقرأ نص المقطع المرسل فعلاً (بعلامات الصفحات) ويستخرج منه كما يفعل
 * نموذج حقيقي جيد، ثم يحقن أخطاء معروفة في الملف الأول ليختبر التحقق والدمج:
 *   - متطلب مخترع (اقتباس غير موجود)            ← يجب أن يصبح «غير موثّق»
 *   - رقم صفحة خاطئ ضمن ±2                      ← «موثّق برقم صفحة مصحّح»
 *   - نص متطلب برقم مختلف عن المصدر (5% بدل 2%)  ← «يحتاج مراجعة»
 *   - المتطلب نفسه مرتين بنفس النص والمصدر         ← يُحذف المكرر التام
 * وفي الملف الثاني: أول رد JSON تالف ثم ردّ صحيح (مسار الإصلاح)،
 * وفي الملف الثالث: مقطع القسم الرابع يفشل دائماً (مسار فشل مقطع جزئي).
 */

interface Page {
  page: number;
  lines: string[];
}

function parseChunk(user: string): { file: number; pages: Page[] } {
  const file = Number(user.match(/ملف (\d+) من/)?.[1] ?? 1);
  const body = user.split("<نص_الكراسة>")[1]?.split("</نص_الكراسة>")[0] ?? "";
  const pages: Page[] = [];
  for (const block of body.split(/\n(?=\[صفحة )/)) {
    const m = block.match(/^\s*\[صفحة (\d+)[^\]]*\]\n([\s\S]*)$/);
    if (m) pages.push({ page: Number(m[1]), lines: m[2].split("\n").map((l) => l.trim()).filter(Boolean) });
  }
  return { file, pages };
}

const words = (s: string, n: number) => s.split(/\s+/).slice(0, n).join(" ");

function category(body: string) {
  if (/الزكاة|سجل تجاري/.test(body)) return "نظامي";
  if (/ضمان/.test(body)) return "مالي";
  if (/المحتوى المحلي/.test(body)) return "محتوى محلي";
  if (/الجودة|الأيزو/.test(body)) return "جودة";
  if (/خبرة|فريق/.test(body)) return "فني";
  return "إداري";
}

export function scriptedExtract(user: string) {
  const { file, pages } = parseChunk(user);
  const requirements: Record<string, unknown>[] = [];
  const summary: Record<string, unknown> = { dates: {}, evaluation: { criteria: [] }, local_content: { mandatory_list_items: [] } };
  const fieldSources: Record<string, unknown> = {};
  let n = 0;

  for (const { page, lines } of pages) {
    for (const line of lines) {
      const kv = line.match(/^(.+?):\s*(.+)$/);
      const set = (field: string, value: string) => {
        const [a, b] = field.split(".");
        if (b) (summary[a] as Record<string, unknown>)[b] = value;
        else summary[a] = value;
        fieldSources[field] = { page, clause: "", quote: line };
      };
      if (kv && kv[1].trim() === "الجهة") set("entity", kv[2]);
      if (kv && kv[1].trim() === "رقم المنافسة") set("tender_number", kv[2]);
      if (kv && kv[1].trim() === "قيمة وثائق المنافسة") set("booklet_price", kv[2]);
      if (kv && kv[1].trim() === "مدة التنفيذ") set("duration", kv[2]);
      const w = line.match(/التقييم الفني بوزن (\S+) والتقييم المالي بوزن (\S+?)\.?$/);
      if (w) {
        set("evaluation.technical_weight", w[1]);
        set("evaluation.financial_weight", w[2]);
        (summary.evaluation as { criteria: unknown[] }).criteria.push({ name: "التقييم الفني", weight: w[1], sub_criteria: [], source: { page, clause: "4.1", quote: `التقييم الفني بوزن ${w[1]}` } });
      }
      const min = line.match(/الحد الأدنى لاجتياز التقييم الفني (\d+) درجة/);
      if (min) set("evaluation.min_technical_score", `${min[1]} درجة`);

      const clause = line.match(/^(\d+(?:\.\d+)?)\s+(.*(?:يجب|يلتزم|يفضّل|يفضل|يتعين).*)$/);
      if (!clause) continue;
      const body = clause[2];
      const quote = words(body.replace(/[.،,]$/, ""), 10);
      const req = {
        local_id: `r${++n}`,
        category: category(body),
        text: body.replace(/[.]$/, ""),
        obligation: /يفض/.test(body) ? "تفضيلي" : "إلزامي",
        disqualifying_if_missing: /يستبعد/.test(body),
        evidence_required: /شهادة/.test(body) ? "صورة الشهادة" : "",
        source: { page, clause: clause[1], quote },
      };
      if (file === 1 && /خبرة مدير المشروع/.test(body)) req.source.page = page + 1; // صفحة خاطئة
      if (file === 1 && /ضمان ابتدائي/.test(body)) req.text = req.text.replace(/2%|%2/, "5%"); // رقم مختلف
      requirements.push(req);
      if (file === 1 && /الزكاة/.test(body)) requirements.push({ ...req, local_id: `r${++n}` }); // مكرر تام
    }
  }
  if (file === 1 && pages.some((p) => p.page === 2)) {
    requirements.push({
      local_id: `r${++n}`,
      category: "جودة",
      text: "تقديم شهادة الأيزو 27001 لأمن المعلومات",
      obligation: "إلزامي",
      disqualifying_if_missing: true,
      evidence_required: "الشهادة",
      source: { page: 2, clause: "2.9", quote: "يجب تقديم شهادة الأيزو 27001 في أمن المعلومات" },
    });
  }

  return {
    tender_summary: summary,
    field_sources: fieldSources,
    requirements,
    staffing_requirements: [],
    deliverables: [],
    technical_offer_required_contents: [],
    risks_and_ambiguities: [],
    verify_notes: pages.some((p) => p.page === 1) ? ["لم تذكر الكراسة في هذا المقطع موعد زيارة الموقع"] : [],
  };
}

export class ScriptedProvider implements LlmProvider {
  readonly name = "scripted";
  calls: LlmRequest[] = [];
  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.calls.push(req);
    const user = req.messages[0].content;
    const { file, pages } = parseChunk(user);
    let text: string;
    if (file === 3 && pages.some((p) => p.lines.some((l) => l.includes("القسم الرابع")))) {
      text = "عذراً، لا أستطيع إكمال هذا المقطع."; // فشل دائم
    } else if (file === 2 && pages.some((p) => p.page === 1) && req.messages.length === 1) {
      text = '```json\n{"requirements": "not-a-list"}\n```'; // تالف أول مرة
    } else {
      text = JSON.stringify(scriptedExtract(user));
    }
    return {
      text,
      model: req.model,
      stopReason: "end_turn",
      usage: { input: Math.ceil((req.system.length + user.length) / 3), output: Math.ceil(text.length / 3), cacheRead: 0, cacheWrite: 0 },
      latencyMs: 1,
    };
  }
}
