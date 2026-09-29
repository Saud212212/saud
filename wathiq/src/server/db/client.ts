import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { env } from "../env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const g = globalThis as unknown as { __wathiqPool?: pg.Pool; __wathiqDb?: Db };

function pool(): pg.Pool {
  if (!g.__wathiqPool) {
    g.__wathiqPool = new pg.Pool({ connectionString: env().DATABASE_URL, max: 10 });
  }
  return g.__wathiqPool;
}

function db(): Db {
  if (!g.__wathiqDb) g.__wathiqDb = drizzle(pool(), { schema });
  return g.__wathiqDb;
}

export interface OrgContext {
  orgId: string;
  userId?: string | null;
}

/**
 * الطريق الوحيد للوصول لبيانات المؤسسات.
 * يفتح معاملة ويضبط app.org_id و app.user_id بـ set_config(..., is_local => true)
 * وهو المكافئ المُمَرَّر بمعاملات لـ SET LOCAL (SET LOCAL لا يقبل bind parameters).
 * القيم تُمسح تلقائياً بنهاية المعاملة فلا تتسرب لاتصال آخر في الـ pool.
 */
export async function withOrg<T>(ctx: OrgContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!ctx.orgId) throw new Error("withOrg: orgId is required");
  return db().transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.org_id', ${ctx.orgId}, true), set_config('app.user_id', ${ctx.userId ?? ""}, true)`,
    );
    return fn(tx);
  });
}

/** سياق مستخدم بلا مؤسسة: يرى نفسه وعضوياته فقط (لاختيار المؤسسة عند الدخول). */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

/**
 * وصول نظامي محدود لجدول job_queue فقط (معرّفات بلا محتوى، بلا RLS).
 * لا يُستخدم لأي جدول آخر؛ أي استعلام على جدول تحت RLS هنا يُرجع صفراً.
 */
export async function withQueue<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closeDb() {
  await g.__wathiqPool?.end();
  g.__wathiqPool = undefined;
  g.__wathiqDb = undefined;
}
