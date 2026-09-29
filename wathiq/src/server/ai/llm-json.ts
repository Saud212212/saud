import type { z } from "zod";
import type { LlmProvider, LlmRequest, LlmResponse } from "./provider";
import { parseJsonLoose } from "../analysis/schema";

/**
 * استدعاء يُرجع JSON مُتحققاً منه بـ Zod. عند فشل التحليل أو المخطط: محاولة إصلاح واحدة
 * بإعادة الخطأ للنموذج. بعدها يُرجع الفشل صراحة (لا نخمّن مخرجات).
 */
export interface JsonCallResult<T> {
  ok: boolean;
  data: T | null;
  attempts: { response: LlmResponse | null; error: string | null }[];
}

export async function callJson<S extends z.ZodTypeAny>(
  provider: LlmProvider,
  req: LlmRequest,
  schema: S,
): Promise<JsonCallResult<z.output<S>>> {
  const attempts: JsonCallResult<z.output<S>>["attempts"] = [];
  let messages = req.messages;
  for (let i = 0; i < 2; i++) {
    const response = await provider.complete({ ...req, messages });
    let error: string;
    try {
      const parsed = schema.safeParse(parseJsonLoose(response.text));
      if (parsed.success) {
        attempts.push({ response, error: null });
        return { ok: true, data: parsed.data, attempts };
      }
      error = parsed.error.issues.slice(0, 8).map((x) => `${x.path.join(".")}: ${x.message}`).join("; ");
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    attempts.push({ response, error });
    messages = [
      ...req.messages,
      { role: "assistant", content: response.text },
      {
        role: "user",
        content: `المخرج السابق لا يطابق الشكل المطلوب (${error}). أعد JSON صالحاً فقط بنفس الشكل المحدد في التعليمات، دون أي نص قبله أو بعده، ودون تغيير أي اقتباس.`,
      },
    ];
  }
  return { ok: false, data: null, attempts };
}
