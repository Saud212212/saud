import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPrompt, parsePromptFile, PromptNotReadyError } from "@/server/ai/prompts";

const file = (id: string, version: string, status: string, body: string) =>
  `---\nid: ${id}\nversion: ${version}\nstatus: ${status}\n---\n\n<!-- note -->\n${body}\n`;

describe("prompt loader", () => {
  it("loads the real prompts shipped in prompts/", async () => {
    for (const task of ["extract", "gaps", "proposal", "clarifications"] as const) {
      const p = await loadPrompt(task);
      expect(p.text).toContain("قواعد لا تُكسر");
      expect(p.version).toBe("1.0.0");
    }
  });

  it("refuses placeholder prompts", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "prompts-"));
    writeFileSync(path.join(dir, "_rules.md"), file("_rules", "1.0.0", "active", "قواعد"));
    writeFileSync(path.join(dir, "gaps.md"), file("gaps", "0.0.0", "placeholder", ""));
    await expect(loadPrompt("gaps", dir)).rejects.toBeInstanceOf(PromptNotReadyError);
  });

  it("merges _rules with the task, keeps both versions, and fingerprints the result", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "prompts-"));
    writeFileSync(path.join(dir, "_rules.md"), file("_rules", "1.2.0", "active", "قواعد"));
    writeFileSync(path.join(dir, "extract.md"), file("extract", "2.0.1", "active", "استخرج"));
    const p = await loadPrompt("extract", dir);
    expect(p).toMatchObject({ task: "extract", version: "2.0.1", rulesVersion: "1.2.0" });
    expect(p.text).toBe("قواعد\n\n---\n\nاستخرج");
    writeFileSync(path.join(dir, "_rules.md"), file("_rules", "1.2.0", "active", "قواعد معدلة"));
    expect((await loadPrompt("extract", dir)).sha256).not.toBe(p.sha256);
  });

  it("strips editor comments from the body", () => {
    expect(parsePromptFile(file("x", "1", "active", "نص"), "x.md").body).toBe("نص");
  });
});
