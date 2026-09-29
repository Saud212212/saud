/**
 * يتحقق من كل القوائم المرجعية: npm run eval:validate
 * (المرحلة 2 ستضيف eval/run.ts لتشغيل الاستخراج وحساب المقاييس)
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { GoldFile, TenderMeta } from "./schema";

const root = path.resolve("eval/tenders");
let errors = 0;
let total = 0;

for (const slug of (await readdir(root)).sort()) {
  const dir = path.join(root, slug);
  if (!(await stat(dir)).isDirectory()) continue;
  const label = slug === "_template" ? "_template (قالب)" : slug;
  try {
    const meta = TenderMeta.parse(JSON.parse(await readFile(path.join(dir, "meta.json"), "utf8")));
    const gold = GoldFile.parse(JSON.parse(await readFile(path.join(dir, "gold.json"), "utf8")));
    const names = new Set(meta.files.map((f) => f.name));
    for (const r of gold.requirements) {
      if (!names.has(r.file)) throw new Error(`${r.id}: file "${r.file}" not listed in meta.json`);
    }
    for (const f of meta.files) {
      const p = path.join(dir, "source", f.name);
      const buf = await readFile(p).catch(() => null);
      if (!buf) {
        if (slug !== "_template") console.warn(`  ! ${label}: source/${f.name} missing (ok if kept outside git)`);
        continue;
      }
      const sha = createHash("sha256").update(buf).digest("hex");
      if (f.sha256 && f.sha256 !== sha) throw new Error(`source/${f.name}: sha256 mismatch (booklet changed?)`);
    }
    const m = gold.requirements.filter((r) => r.obligation === "mandatory").length;
    const d = gold.requirements.filter((r) => r.disqualifying).length;
    total += gold.requirements.length;
    console.log(`✓ ${label}: ${gold.requirements.length} requirements (${m} mandatory, ${d} disqualifying)${meta.reviewed ? "" : " — not reviewed"}`);
  } catch (e) {
    errors++;
    console.error(`✗ ${label}: ${e instanceof Error ? e.message : e}`);
  }
}
console.log(`\n${total} gold requirements total`);
process.exit(errors ? 1 : 0);
