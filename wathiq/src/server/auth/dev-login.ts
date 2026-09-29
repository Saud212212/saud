import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * الدخول التجريبي (المراحل 1–4) وجلساته.
 * معطّل برمجياً في الإنتاج بغض النظر عن DEV_LOGIN، وجلساته تُرفض في الإنتاج حتى لو كانت موقّعة صحيحاً.
 * (بلا "server-only" حتى تُختبر مباشرة.)
 */
type EnvLike = Record<string, string | undefined>;

export function devLoginEnabled(e: EnvLike = process.env): boolean {
  return e.NODE_ENV !== "production" && e.DEV_LOGIN === "true";
}

export class DevLoginDisabledError extends Error {
  constructor() {
    super("dev login is disabled (NODE_ENV=production or DEV_LOGIN is not 'true')");
  }
}

export function assertDevLoginEnabled(e: EnvLike = process.env) {
  if (!devLoginEnabled(e)) throw new DevLoginDisabledError();
}

const PREFIX = "dev";
const sign = (secret: string, v: string) => createHmac("sha256", secret).update(v).digest("base64url");

export function encodeDevSession(secret: string, userId: string, e: EnvLike = process.env): string {
  assertDevLoginEnabled(e);
  const payload = `${PREFIX}:${userId}`;
  return `${payload}.${sign(secret, payload)}`;
}

/** يُرجع معرّف المستخدم، أو null إن كانت الجلسة غير صالحة — أو إن كنا في الإنتاج. */
export function decodeDevSession(secret: string, raw: string | undefined, e: EnvLike = process.env): string | null {
  if (!raw || e.NODE_ENV === "production") return null;
  const i = raw.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = raw.slice(0, i);
  if (!payload.startsWith(`${PREFIX}:`)) return null;
  const a = Buffer.from(raw.slice(i + 1));
  const b = Buffer.from(sign(secret, payload));
  return a.length === b.length && timingSafeEqual(a, b) ? payload.slice(PREFIX.length + 1) : null;
}
