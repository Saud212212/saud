import { readFileSync } from "node:fs";
import pg from "pg";
import { ADMIN_TEST_DB_URL } from "../test-env";
import { DEV_ORGS, DEV_USERS } from "@/server/dev-users";
import { processOne } from "@/worker/run";

export const orgA = DEV_ORGS[0].id;
export const orgB = DEV_ORGS[1].id;
export const ownerA = { orgId: orgA, userId: DEV_USERS[0].id };
export const editorA = { orgId: orgA, userId: DEV_USERS[1].id };
export const ownerB = { orgId: orgB, userId: DEV_USERS[2].id };

export const fixture = (name: string) => ({
  name: `${name}.pdf`,
  mime: "application/pdf",
  data: readFileSync(`tests/fixtures/${name}.pdf`),
  role: "booklet" as const,
});

const quiet = { info() {}, warn() {}, error: console.error } as unknown as Console;

/** يشغّل العامل حتى يفرغ الطابور. */
export async function drainQueue(max = 20) {
  const results = [];
  for (let i = 0; i < max; i++) {
    const r = await processOne("test-worker", quiet);
    if (r === "idle") break;
    results.push(r);
  }
  return results;
}

/** اتصال superuser لفحص الحالة الفعلية في القاعدة (يتجاوز RLS) — للتحقق فقط. */
export async function admin<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: ADMIN_TEST_DB_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}
