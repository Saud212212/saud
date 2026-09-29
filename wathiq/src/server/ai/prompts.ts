import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * محمّل البرومتات: ملفات prompts/*.md بترويسة (id, version, status).
 * البرومت النهائي = _rules.md + ملف المهمة، مع بصمة تُسجَّل مع كل استدعاء للنموذج.
 */
export type PromptTask = "extract" | "gaps" | "proposal" | "clarifications";

export interface PromptFile {
  id: string;
  version: string;
  status: "active" | "placeholder" | "draft";
  body: string;
}

export interface LoadedPrompt {
  task: PromptTask;
  version: string;
  rulesVersion: string;
  /** النص المدمج المرسل للنموذج */
  text: string;
  /** sha256 للنص المدمج — يتغير مع أي تعديل في أي من الملفين */
  sha256: string;
}

export class PromptNotReadyError extends Error {}

export function parsePromptFile(raw: string, name: string): PromptFile {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${name}: missing front matter`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (!meta.id || !meta.version) throw new Error(`${name}: front matter needs id and version`);
  const status = (meta.status ?? "active") as PromptFile["status"];
  // التعليقات HTML ملاحظات للمحرر ولا تُرسل للنموذج
  const body = m[2].replace(/<!--[\s\S]*?-->/g, "").trim();
  return { id: meta.id, version: meta.version, status, body };
}

export async function loadPrompt(task: PromptTask, dir = path.resolve("prompts")): Promise<LoadedPrompt> {
  const [rules, main] = await Promise.all(
    ["_rules", task].map(async (n) => parsePromptFile(await readFile(path.join(dir, `${n}.md`), "utf8"), `${n}.md`)),
  );
  for (const p of [rules, main]) {
    if (p.status !== "active" || !p.body) {
      throw new PromptNotReadyError(`prompt "${p.id}" is ${p.status}${p.body ? "" : " and empty"} — fill prompts/${p.id}.md and set status: active`);
    }
  }
  const text = `${rules.body}\n\n---\n\n${main.body}`;
  return { task, version: main.version, rulesVersion: rules.version, text, sha256: createHash("sha256").update(text).digest("hex") };
}
