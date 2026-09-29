import { readFile } from "node:fs/promises";
import { rm } from "node:fs/promises";
import pg from "pg";
import { ADMIN_URL, OWNER_URL, TEST_DB } from "./test-env";
import { migrateAll } from "../scripts/migrate";

/** ينشئ قاعدة اختبار نظيفة: الأدوار ← قاعدة جديدة يملكها wathiq_owner ← الترحيلات. */
export default async function setup() {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await admin.connect();
  } catch (e) {
    throw new Error(
      `Integration tests need PostgreSQL (TEST_ADMIN_DATABASE_URL=${ADMIN_URL}): ${(e as Error).message}`,
    );
  }
  await admin.query(await readFile("infra/postgres/init-roles.sql", "utf8"));
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB} owner wathiq_owner`);
  await admin.end();
  await migrateAll({ mainUrl: OWNER_URL }).catch((e) => {
    throw e;
  });
  await rm(".data/test-storage", { recursive: true, force: true });
}
