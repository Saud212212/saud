/** سكربت eval من طرف لطرف على المثال التوضيحي (بالنموذج المُبرمَج). */
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/server/db/client";
import { closeKeystore } from "@/server/crypto/keystore";
import { seed } from "../../scripts/seed";
import { runEval } from "../../eval/run";
import { admin, ownerA } from "./helpers";

beforeAll(async () => {
  await seed();
  await admin((c) => c.query("delete from job_queue"));
});
afterAll(async () => {
  await closeDb();
  await closeKeystore();
});

describe("eval script", () => {
  it("scores the example against its gold list, writes a report, and deletes the eval tender", async () => {
    const out = mkdtempSync(path.join(os.tmpdir(), "wathiq-eval-"));
    const { results } = await runEval({ slugs: ["example-fixture"], outDir: out, ctx: ownerA, log: () => {} });
    const r = results[0];
    // النموذج المُبرمَج يلتقط 2.1–3.2 ويفوّت 3.3 (صياغة خبرية بلا يجب/يلتزم)، ويخترع متطلباً واحداً
    expect(r.score.metrics.mandatoryRecall).toBe(0.833); // 5 من 6
    expect(r.score.missedMandatory.map((m) => m.id)).toEqual(["G-007"]);
    expect(r.score.metrics.inventedRate).toBe(0); // كل المعروض له مقابل مرجعي
    expect(r.score.counts.extractedUnverified).toBe(1); // المخترع لم يُعرض كمتطلب
    expect(r.score.metrics.fabricatedRate).toBeGreaterThan(0);
    expect(r.goldQuoteIssues).toEqual([]); // اقتباسات القائمة المرجعية موجودة فعلاً في الكراسة
    expect(r.prompt.version).toBe("1.0.0");
    const md = readFileSync(path.join(out, "summary.md"), "utf8");
    expect(md).toContain("example-fixture");
    expect(md).toContain("G-007");
    const left = await admin((c) => c.query(`select count(*)::int n from tenders where id = $1`, [r.tenderId]));
    expect(left.rows[0].n).toBe(0);
  });
});
