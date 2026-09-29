import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { aiConfig, type AiConfig, type Effort } from "./config";

/**
 * طبقة تجريد المزود. بقية الكود لا تعرف أي مزود يعمل.
 * تُرجع النص الخام؛ التحقق من المخطط (Zod) وإعادة المحاولة عند الخطأ في طبقة أعلى (llm-json.ts).
 */
export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  model: string;
  effort: Effort;
  maxTokens: number;
  /** ثابت عبر كل الاستدعاءات (القواعد + المهمة) — يُخزَّن مؤقتاً لدى المزود */
  system: string;
  messages: LlmMessage[];
}

export interface LlmResponse {
  text: string;
  /** النموذج الذي خدم الطلب فعلاً (قد يختلف عند التحويل الاحتياطي) */
  model: string;
  stopReason: string | null;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  latencyMs: number;
}

export interface LlmProvider {
  readonly name: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}

export class LlmRefusalError extends Error {}
export class LlmTruncatedError extends Error {}

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  constructor(private cfg: AiConfig) {
    // المفتاح من ANTHROPIC_API_KEY (أو ملف تعريف ant)؛ إعادة المحاولة التلقائية لأخطاء 429/5xx
    this.client = new Anthropic({ maxRetries: 4 });
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const t0 = Date.now();
    const fallback = this.cfg.AI_FALLBACKS === "default";
    // بث + finalMessage: المخرجات الطويلة (عشرات المتطلبات) لا تصطدم بمهلة HTTP
    const stream = this.client.beta.messages.stream({
      model: req.model,
      max_tokens: req.maxTokens,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: req.messages,
      output_config: { effort: req.effort },
      ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new LlmRefusalError(`model declined (${msg.stop_details?.category ?? "unknown"})`);
    if (msg.stop_reason === "max_tokens") throw new LlmTruncatedError(`output truncated at ${req.maxTokens} tokens`);
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return {
      text,
      model: msg.model,
      stopReason: msg.stop_reason,
      usage: {
        input: msg.usage.input_tokens,
        output: msg.usage.output_tokens,
        cacheRead: msg.usage.cache_read_input_tokens ?? 0,
        cacheWrite: msg.usage.cache_creation_input_tokens ?? 0,
      },
      latencyMs: Date.now() - t0,
    };
  }
}

/** مفتاح ثابت للطلب (النموذج + الجهد + البرومت + الرسائل) لأجل التسجيل وإعادة التشغيل. */
export const requestKey = (r: LlmRequest) =>
  createHash("sha256").update(JSON.stringify([r.model, r.effort, r.system, r.messages])).digest("hex");

/** يعيد استجابات مسجّلة فقط — للـ eval القابل للتكرار بلا كلفة، ولاختبارات الانحدار. */
export class ReplayProvider implements LlmProvider {
  readonly name = "replay";
  constructor(private dir: string) {}
  async complete(req: LlmRequest): Promise<LlmResponse> {
    const file = path.join(this.dir, `${requestKey(req)}.json`);
    const raw = await readFile(file, "utf8").catch(() => {
      throw new Error(`no recorded response for this request (${path.basename(file)}); record it first with AI_RECORD_DIR`);
    });
    return JSON.parse(raw) as LlmResponse;
  }
}

/** يغلّف مزوداً ويسجّل كل استجابة. التسجيلات تحتوي نص الكراسة: تُعامل كبيانات حساسة. */
export class RecordingProvider implements LlmProvider {
  constructor(private inner: LlmProvider, private dir: string) {}
  get name() {
    return `${this.inner.name}+record`;
  }
  async complete(req: LlmRequest): Promise<LlmResponse> {
    const res = await this.inner.complete(req);
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    await writeFile(path.join(this.dir, `${requestKey(req)}.json`), JSON.stringify(res), { mode: 0o600 });
    return res;
  }
}

let override: LlmProvider | undefined;
/** للاختبارات: حقن مزود. */
export function setLlmProvider(p: LlmProvider | undefined) {
  override = p;
}

export function llmProvider(cfg: AiConfig = aiConfig()): LlmProvider {
  if (override) return override;
  let p: LlmProvider;
  if (cfg.AI_PROVIDER === "replay") {
    if (!cfg.AI_REPLAY_DIR) throw new Error("AI_PROVIDER=replay requires AI_REPLAY_DIR");
    p = new ReplayProvider(cfg.AI_REPLAY_DIR);
  } else {
    p = new AnthropicProvider(cfg);
  }
  return cfg.AI_RECORD_DIR && cfg.AI_PROVIDER !== "replay" ? new RecordingProvider(p, cfg.AI_RECORD_DIR) : p;
}
