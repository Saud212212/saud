/**
 * مشغّل ترحيلات بسيط: يطبّق ملفات SQL بالترتيب مرة واحدة، كل ملف في معاملة.
 *   - migrations/          على MIGRATION_DATABASE_URL (دور wathiq_owner)
 *   - migrations-keystore/ على KEYSTORE_MIGRATION_DATABASE_URL (افتراضياً نفس القاعدة)
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

export async function migrateDir(url: string, dir: string, table: string, log = console.info) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`create table if not exists ${table} (name text primary key, applied_at timestamptz not null default now())`);
    const applied = new Set((await client.query<{ name: string }>(`select name from ${table}`)).rows.map((r) => r.name));
    const filesInDir = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const f of filesInDir) {
      if (applied.has(f)) continue;
      const sqlText = await readFile(path.join(dir, f), "utf8");
      await client.query("begin");
      try {
        await client.query(sqlText);
        await client.query(`insert into ${table} (name) values ($1)`, [f]);
        await client.query("commit");
        log(`applied ${path.basename(dir)}/${f}`);
      } catch (e) {
        await client.query("rollback");
        throw new Error(`migration ${f} failed: ${(e as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
}

export async function migrateAll(opts: { mainUrl: string; keystoreUrl?: string; root?: string }) {
  const root = opts.root ?? process.cwd();
  await migrateDir(opts.mainUrl, path.join(root, "migrations"), "schema_migrations");
  await migrateDir(opts.keystoreUrl ?? opts.mainUrl, path.join(root, "migrations-keystore"), "keystore_migrations");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join("scripts", "migrate.ts"));
if (isMain) {
  const mainUrl = process.env.MIGRATION_DATABASE_URL;
  if (!mainUrl) {
    console.error("MIGRATION_DATABASE_URL is required (wathiq_owner role)");
    process.exit(1);
  }
  migrateAll({ mainUrl, keystoreUrl: process.env.KEYSTORE_MIGRATION_DATABASE_URL })
    .then(() => console.info("migrations up to date"))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
