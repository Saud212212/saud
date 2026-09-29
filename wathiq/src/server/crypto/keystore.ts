import pg from "pg";
import { env } from "../env";
import { EnvKeyWrapper, newDataKey, type KeyWrapper } from "./envelope";

/**
 * مخزن مفاتيح المنافسات (DEK لكل منافسة).
 * يتصل بـ KEYSTORE_DATABASE_URL إن وُجد (قاعدة مستقلة بنسخ احتياطي قصير)، وإلا بقاعدة التطبيق.
 * الجدول تحت RLS بنفس سياق المؤسسة.
 */
const g = globalThis as unknown as {
  __wathiqKeyPool?: pg.Pool;
  __wathiqWrapper?: KeyWrapper;
  __wathiqDekCache?: Map<string, { key: Buffer; at: number }>;
};

const CACHE_TTL_MS = 5 * 60_000;
// المفتاح في الذاكرة مرتبط بالمؤسسة أيضاً: طلب من مؤسسة أخرى لا يصيب الذاكرة المؤقتة أبداً
// ويذهب لقاعدة البيانات حيث تمنعه RLS.
const cacheKey = (orgId: string, tenderId: string) => `${orgId}:${tenderId}`;

function keyPool() {
  if (!g.__wathiqKeyPool) {
    g.__wathiqKeyPool = new pg.Pool({
      connectionString: env().KEYSTORE_DATABASE_URL ?? env().DATABASE_URL,
      max: 5,
    });
  }
  return g.__wathiqKeyPool;
}

function wrapper(): KeyWrapper {
  if (!g.__wathiqWrapper) g.__wathiqWrapper = new EnvKeyWrapper(env().WATHIQ_MASTER_KEYS);
  return g.__wathiqWrapper;
}

function cache() {
  if (!g.__wathiqDekCache) g.__wathiqDekCache = new Map();
  return g.__wathiqDekCache;
}

async function inOrg<T>(orgId: string, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await keyPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("select set_config('app.org_id', $1, true)", [orgId]);
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

const aadFor = (tenderId: string) => `tender:${tenderId}`;

export async function createTenderKey(orgId: string, tenderId: string): Promise<Buffer> {
  const dek = newDataKey();
  const { kekId, wrapped } = await wrapper().wrap(dek, aadFor(tenderId));
  await inOrg(orgId, (c) =>
    c.query("insert into tender_keys (tender_id, org_id, kek_id, wrapped_dek) values ($1, $2, $3, $4)", [
      tenderId,
      orgId,
      kekId,
      wrapped,
    ]),
  );
  cache().set(cacheKey(orgId, tenderId), { key: dek, at: Date.now() });
  return dek;
}

export class TenderKeyMissingError extends Error {
  constructor(tenderId: string) {
    super(`encryption key for tender ${tenderId} not found (deleted or wrong organization)`);
  }
}

export async function getTenderKey(orgId: string, tenderId: string): Promise<Buffer> {
  const hit = cache().get(cacheKey(orgId, tenderId));
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.key;
  const row = await inOrg(orgId, async (c) => {
    const r = await c.query<{ kek_id: string; wrapped_dek: Buffer }>(
      "select kek_id, wrapped_dek from tender_keys where tender_id = $1",
      [tenderId],
    );
    return r.rows[0];
  });
  if (!row) throw new TenderKeyMissingError(tenderId);
  const dek = await wrapper().unwrap(row.kek_id, row.wrapped_dek, aadFor(tenderId));
  cache().set(cacheKey(orgId, tenderId), { key: dek, at: Date.now() });
  return dek;
}

/** إتلاف المفتاح (crypto-shredding). بعده لا يمكن فك أي نص أو ملف لهذه المنافسة. */
export async function destroyTenderKey(orgId: string, tenderId: string): Promise<boolean> {
  const existing = cache().get(cacheKey(orgId, tenderId));
  existing?.key.fill(0);
  cache().delete(cacheKey(orgId, tenderId));
  const res = await inOrg(orgId, (c) => c.query("delete from tender_keys where tender_id = $1", [tenderId]));
  return (res.rowCount ?? 0) > 0;
}

export async function closeKeystore() {
  await g.__wathiqKeyPool?.end();
  g.__wathiqKeyPool = undefined;
  g.__wathiqDekCache?.clear();
}
