/**
 * تشغيل التقييم: npm run eval [-- --slug <slug>] [--keep]
 *
 * لكل كراسة في eval/tenders/<slug>: يرفعها كمنافسة حقيقية في مؤسسة التقييم، يشغّل خط المعالجة كاملاً
 * (استخراج + OCR + تحليل بالنموذج + تحقق + دمج)، يقارن بالقائمة المرجعية، يكتب تقريراً في eval/runs/،
 * ثم يحذف المنافسة نهائياً (إلا مع --keep).
 *
 * الكلفة: كل تشغيل يستدعي النموذج فعلاً. للتكرار بلا كلفة: سجّل مرة بـ AI_RECORD_DIR ثم أعد التشغيل
 * بـ AI_PROVIDER=replay AI_REPLAY_DIR=<نفس المجلد> (التسجيلات تحتوي نص الكراسة: لا تُرفع للمستودع).
 */
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { withOrg, closeDb } from "../src/server/db/client";
import { tenders } from "../src/server/db/schema";
import { closeKeystore } from "../src/server/crypto/keystore";
import { createTender, getPageContent, getTenderDetail, hardDeleteTender } from "../src/server/services/tenders";
import { getAnalysisJob, listRequirements } from "../src/server/services/analysis";
import { PageIndex, verifyQuote } from "../src/server/analysis/verify";
import { loadPrompt } from "../src/server/ai/prompts";
import { taskSettings } from "../src/server/ai/config";
import { processOne } from "../src/worker/run";
import { DEV_USERS } from "../src/server/dev-users";
import { GoldFile, TenderMeta } from "./schema";
import { scoreTender, type ExtractedForEval, type ScoreReport } from "./score";

export interface EvalOptions {
  root?: string;
  slugs?: string[];
  keep?: boolean;
  outDir?: string;
  ctx?: { orgId: string; userId: string };
  timeoutMs?: number;
  log?: (msg: string) => void;
}

export interface TenderEvalResult {
  slug: string;
  title: string;
  tenderId: string;
  prompt: { version: string; rulesVersion: string; sha256: string };
  model: string;
  analysis: { status: string; chunksTotal?: number; chunksFailed?: number; failedChunks?: unknown[]; tokens?: unknown };
  goldQuoteIssues: { id: string; page: number; status: string; matchedPage: number | null }[];
  score: ScoreReport;
}

async function waitForTender(ctx: { orgId: string; userId: string }, tenderId: string, timeoutMs: number) {
  const quiet = { info() {}, warn() {}, error: console.error } as unknown as Console;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [t] = await withOrg(ctx, (tx) => tx.select({ status: tenders.status }).from(tenders).where(eq(tenders.id, tenderId)));
    if (t?.status === "ready" || t?.status === "failed") return t.status;
    const r = await processOne("eval", quiet);
    if (r === "idle") await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`tender ${tenderId} did not finish within ${timeoutMs}ms`);
}

export async function evalTender(slug: string, opts: EvalOptions = {}): Promise<TenderEvalResult> {
  const root = opts.root ?? path.resolve("eval/tenders");
  const ctx = opts.ctx ?? { orgId: process.env.EVAL_ORG_ID ?? DEV_USERS[0].orgId, userId: process.env.EVAL_USER_ID ?? DEV_USERS[0].id };
  const log = opts.log ?? console.info;
  const dir = path.join(root, slug);
  const meta = TenderMeta.parse(JSON.parse(await readFile(path.join(dir, "meta.json"), "utf8")));
  const gold = GoldFile.parse(JSON.parse(await readFile(path.join(dir, "gold.json"), "utf8"))).requirements;

  const files = await Promise.all(
    meta.files.map(async (f) => ({ name: f.name, mime: "application/pdf", role: f.role, data: await readFile(path.join(dir, "source", f.name)) })),
  );
  log(`▶ ${slug}: uploading ${files.length} file(s), ${gold.length} gold requirements`);
  const { tenderId } = await createTender(ctx, { title: `[eval] ${meta.title}`, files });

  try {
    const final = await waitForTender(ctx, tenderId, opts.timeoutMs ?? 60 * 60_000);
    const job = await getAnalysisJob(ctx, tenderId);
    const reqs = await listRequirements(ctx, tenderId);
    const extracted: ExtractedForEval[] = reqs.map((r) => ({
      code: r.code,
      fileName: r.source.fileName,
      page: r.source.matchedPage ?? r.source.statedPage,
      text: r.text,
      quote: r.source.quote,
      matchedText: r.source.matchedText,
      obligation: r.obligation,
      category: r.category,
      disqualifying: r.disqualifying,
      verification: r.source.verification,
    }));

    // القائمة المرجعية نفسها قد تخطئ: نتحقق أن اقتباساتها موجودة في الصفحات المذكورة
    const detail = await getTenderDetail(ctx, tenderId);
    const byName = new Map(detail.files.map((f) => [f.name, f.id]));
    const goldQuoteIssues: TenderEvalResult["goldQuoteIssues"] = [];
    const indexCache = new Map<string, PageIndex>();
    for (const g of gold) {
      const tfId = byName.get(g.file);
      if (!tfId) continue;
      if (!indexCache.has(tfId)) {
        const pages = new Map();
        for (const p of detail.pages.filter((x) => x.tenderFileId === tfId)) {
          const c = await getPageContent(ctx, tenderId, tfId, p.pageNo);
          pages.set(p.pageNo, { text: c.content.text, words: c.content.words, lowConfidence: false, ocr: false });
        }
        indexCache.set(tfId, new PageIndex(pages));
      }
      const v = verifyQuote({ quote: g.quote, page: g.page }, indexCache.get(tfId)!, { ocrNumbers: "low" });
      if (v.status !== "verified") goldQuoteIssues.push({ id: g.id, page: g.page, status: v.status, matchedPage: v.matchedPage });
    }

    const prompt = await loadPrompt("extract");
    const score = scoreTender(gold, extracted);
    const d = (job?.detail ?? {}) as TenderEvalResult["analysis"];
    const m = score.metrics;
    log(
      `  ${slug}: tender=${final} mandatoryRecall=${m.mandatoryRecall ?? "—"} inventedRate=${m.inventedRate ?? "—"} fabricatedRate=${m.fabricatedRate ?? "—"} ` +
        `(gold ${score.counts.gold}, shown ${score.counts.extractedShown}, unverified ${score.counts.extractedUnverified})`,
    );
    return {
      slug,
      title: meta.title,
      tenderId,
      prompt: { version: prompt.version, rulesVersion: prompt.rulesVersion, sha256: prompt.sha256 },
      model: taskSettings("extract").model,
      analysis: { status: job?.status ?? "missing", chunksTotal: d.chunksTotal, chunksFailed: d.chunksFailed, failedChunks: d.failedChunks, tokens: d.tokens },
      goldQuoteIssues,
      score,
    };
  } finally {
    if (!opts.keep) await hardDeleteTender(ctx, tenderId).catch((e) => log(`  ! could not delete eval tender ${tenderId}: ${e.message}`));
  }
}

const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);

export function summaryMarkdown(results: TenderEvalResult[]) {
  const lines = [
    `# تقرير التقييم`,
    "",
    `النموذج: \`${results[0]?.model ?? "—"}\` · البرومت: extract v${results[0]?.prompt.version ?? "—"} / rules v${results[0]?.prompt.rulesVersion ?? "—"} (\`${results[0]?.prompt.sha256.slice(0, 12) ?? ""}\`)`,
    "",
    "| الكراسة | التقاط الإلزامي | التقاط المستبعِد | المخترع (مقارنة بالمرجع) | غير موثّق | مرجعي | معروض | مقاطع فاشلة | أخطاء في المرجع |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  let gm = 0, cm = 0, shown = 0, unmatched = 0;
  for (const r of results) {
    const m = r.score.metrics;
    lines.push(
      `| ${r.slug} | ${pct(m.mandatoryRecall)} | ${pct(m.disqualifyingRecall)} | ${pct(m.inventedRate)} | ${pct(m.fabricatedRate)} | ${r.score.counts.gold} | ${r.score.counts.extractedShown} | ${r.analysis.chunksFailed ?? 0} | ${r.goldQuoteIssues.length} |`,
    );
    gm += r.score.counts.goldMandatory;
    cm += r.score.counts.goldMandatory - r.score.missedMandatory.length;
    shown += r.score.counts.extractedShown;
    unmatched += r.score.unmatchedExtracted.length;
  }
  lines.push("", `**الإجمالي (micro):** التقاط الإلزامي ${pct(gm ? cm / gm : null)} · المخترع ${pct(shown ? unmatched / shown : null)}`);
  for (const r of results) {
    if (!r.score.missedMandatory.length) continue;
    lines.push("", `## ${r.slug}: متطلبات إلزامية فائتة`);
    for (const x of r.score.missedMandatory)
      lines.push(`- ${x.id} (ص ${x.page}): ${x.text}${x.nearestUnverified ? ` — التقطه النموذج كـ ${x.nearestUnverified} لكن اقتباسه لم يُتحقق منه` : ""}`);
  }
  return lines.join("\n") + "\n";
}

export async function runEval(opts: EvalOptions = {}) {
  const root = opts.root ?? path.resolve("eval/tenders");
  const all = [];
  for (const name of (await readdir(root)).sort()) {
    if (name.startsWith("_")) continue;
    if ((await stat(path.join(root, name))).isDirectory()) all.push(name);
  }
  const slugs = opts.slugs?.length ? opts.slugs : all;
  const results: TenderEvalResult[] = [];
  for (const s of slugs) results.push(await evalTender(s, { ...opts, root }));
  const out = opts.outDir ?? path.resolve("eval/runs", new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(out, { recursive: true });
  for (const r of results) await writeFile(path.join(out, `${r.slug}.json`), JSON.stringify(r, null, 2));
  await writeFile(path.join(out, "summary.md"), summaryMarkdown(results));
  return { results, out };
}

const isMain = process.argv[1]?.endsWith(path.join("eval", "run.ts"));
if (isMain) {
  const args = process.argv.slice(2);
  const slugs = args.flatMap((a, i) => (a === "--slug" ? [args[i + 1]] : []));
  runEval({ slugs, keep: args.includes("--keep") })
    .then(({ out }) => console.info(`\nreport: ${path.relative(process.cwd(), out)}/summary.md`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeDb();
      await closeKeystore();
    });
}
