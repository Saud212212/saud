/**
 * تطوير فقط: يحذف قاعدتي التطوير (التطبيق + المفاتيح) ويعيد إنشاءهما ثم الترحيلات والزرع.
 * يحتاج ADMIN_DATABASE_URL (superuser). يرفض العمل إذا NODE_ENV=production.
 */
import { readFile } from "node:fs/promises";
import pg from "pg";
import { migrateAll } from "./migrate";

if (process.env.NODE_ENV === "production") throw new Error("db:reset is disabled in production");
const admin = process.env.ADMIN_DATABASE_URL;
const appDb = process.env.DEV_DATABASE_NAME ?? "wathiq_dev";
const keysDb = process.env.DEV_KEYSTORE_DATABASE_NAME ?? `${appDb}_keys`;
if (!admin) throw new Error("ADMIN_DATABASE_URL is required");

const c = new pg.Client({ connectionString: admin });
await c.connect();
await c.query(await readFile("infra/postgres/init-roles.sql", "utf8"));
for (const db of [appDb, keysDb]) {
  await c.query(`drop database if exists ${db} with (force)`);
  await c.query(`create database ${db} owner wathiq_owner`);
}
await c.end();

const owner = (db: string) => {
  const u = new URL(admin);
  u.username = "wathiq_owner";
  u.password = "wathiq_owner_dev";
  u.pathname = `/${db}`;
  return u.toString();
};
await migrateAll({ mainUrl: owner(appDb), keystoreUrl: owner(keysDb) });
console.info(`reset ${appDb} + ${keysDb}. Set KEYSTORE_DATABASE_URL to the ${keysDb} database, then run npm run db:seed`);
