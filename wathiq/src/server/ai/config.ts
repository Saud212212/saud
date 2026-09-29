import { z } from "zod";
import type { PromptTask } from "./prompts";

/**
 * إعدادات النموذج اللغوي — من متغيرات البيئة، لا من الكود.
 *   AI_PROVIDER            anthropic | replay
 *   AI_MODEL               النموذج الافتراضي لكل المهام
 *   AI_MODEL_<TASK>        نموذج لمهمة بعينها (EXTRACT, GAPS, PROPOSAL, CLARIFICATIONS)
 *   AI_EFFORT / AI_EFFORT_<TASK>  low | medium | high | xhigh | max
 *   AI_FALLBACKS           default | off  (إعادة المحاولة على نموذج آخر عند الرفض، من جهة الخادم)
 *   AI_RECORD_DIR          يسجّل كل استجابة (لإعادة التشغيل المجاني في eval)
 *   AI_REPLAY_DIR          مع AI_PROVIDER=replay: يعيد الاستجابات المسجّلة فقط
 */
const Effort = z.enum(["low", "medium", "high", "xhigh", "max"]);
export type Effort = z.infer<typeof Effort>;

const schema = z.object({
  AI_PROVIDER: z.enum(["anthropic", "replay"]).default("anthropic"),
  AI_MODEL: z.string().default("claude-opus-5-5"),
  AI_MODEL_EXTRACT: z.string().optional(),
  AI_MODEL_GAPS: z.string().optional(),
  AI_MODEL_PROPOSAL: z.string().optional(),
  AI_MODEL_CLARIFICATIONS: z.string().optional(),
  // الدقة مقدَّمة على الكلفة في الاستخراج (متطلب فائت قد يستبعد العرض)
  AI_EFFORT: Effort.default("high"),
  AI_EFFORT_EXTRACT: Effort.optional(),
  AI_EFFORT_GAPS: Effort.optional(),
  AI_EFFORT_PROPOSAL: Effort.optional(),
  AI_EFFORT_CLARIFICATIONS: Effort.optional(),
  AI_MAX_TOKENS: z.coerce.number().default(32000),
  AI_CONCURRENCY: z.coerce.number().default(4),
  AI_FALLBACKS: z.enum(["default", "off"]).default("default"),
  AI_RECORD_DIR: z.string().optional(),
  AI_REPLAY_DIR: z.string().optional(),
});
export type AiConfig = z.infer<typeof schema>;

export function aiConfig(e: Record<string, string | undefined> = process.env): AiConfig {
  return schema.parse(e);
}

export function taskSettings(task: PromptTask, c: AiConfig = aiConfig()) {
  const key = task.toUpperCase() as "EXTRACT" | "GAPS" | "PROPOSAL" | "CLARIFICATIONS";
  return {
    model: c[`AI_MODEL_${key}`] ?? c.AI_MODEL,
    effort: c[`AI_EFFORT_${key}`] ?? c.AI_EFFORT,
    maxTokens: c.AI_MAX_TOKENS,
  };
}
