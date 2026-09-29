import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * تشفير AES-256-GCM بصيغة ثابتة:
 *   [version:1][iv:12][tag:16][ciphertext]
 * الـ AAD يربط النص المشفّر بموضعه (مثلاً "page:<tenderFileId>:<n>") فلا يمكن
 * نقل نص مشفّر من صف لآخر دون أن يفشل الفك.
 */
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

export function encryptBytes(key: Buffer, plaintext: Buffer, aad: string): Buffer {
  if (key.length !== 32) throw new Error("encryptBytes: key must be 32 bytes");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), ct]);
}

export function decryptBytes(key: Buffer, payload: Buffer, aad: string): Buffer {
  if (payload.length < 1 + IV_LEN + TAG_LEN) throw new Error("decryptBytes: payload too short");
  if (payload[0] !== VERSION) throw new Error(`decryptBytes: unsupported version ${payload[0]}`);
  const iv = payload.subarray(1, 1 + IV_LEN);
  const tag = payload.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ct = payload.subarray(1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function encryptJson(key: Buffer, value: unknown, aad: string): Buffer {
  return encryptBytes(key, Buffer.from(JSON.stringify(value), "utf8"), aad);
}

export function decryptJson<T>(key: Buffer, payload: Buffer, aad: string): T {
  return JSON.parse(decryptBytes(key, payload, aad).toString("utf8")) as T;
}

export function newDataKey(): Buffer {
  return randomBytes(32);
}

// ─── تغليف المفاتيح ──────────────────────────────────────────────────────────

/** واجهة مغلّف المفاتيح. التطبيق الحالي من متغير بيئة؛ لاحقاً KMS بنفس الواجهة. */
export interface KeyWrapper {
  readonly activeKekId: string;
  wrap(dek: Buffer, aad: string): Promise<{ kekId: string; wrapped: Buffer }>;
  unwrap(kekId: string, wrapped: Buffer, aad: string): Promise<Buffer>;
}

/** WATHIQ_MASTER_KEYS="k2:base64,k1:base64" — الأول نشط، والبقية لفك المفاتيح القديمة (تدوير). */
export class EnvKeyWrapper implements KeyWrapper {
  private keys = new Map<string, Buffer>();
  readonly activeKekId: string;

  constructor(spec: string) {
    const entries = spec.split(",").map((s) => s.trim()).filter(Boolean);
    if (!entries.length) throw new Error("WATHIQ_MASTER_KEYS is empty");
    for (const entry of entries) {
      const idx = entry.indexOf(":");
      if (idx <= 0) throw new Error("WATHIQ_MASTER_KEYS entries must be kid:base64");
      const kid = entry.slice(0, idx);
      const key = Buffer.from(entry.slice(idx + 1), "base64");
      if (key.length !== 32) throw new Error(`master key "${kid}" must decode to 32 bytes`);
      this.keys.set(kid, key);
    }
    this.activeKekId = entries[0].slice(0, entries[0].indexOf(":"));
  }

  async wrap(dek: Buffer, aad: string) {
    const kek = this.keys.get(this.activeKekId)!;
    return { kekId: this.activeKekId, wrapped: encryptBytes(kek, dek, `kek:${aad}`) };
  }

  async unwrap(kekId: string, wrapped: Buffer, aad: string) {
    const kek = this.keys.get(kekId);
    if (!kek) throw new Error(`unknown master key id "${kekId}"`);
    return decryptBytes(kek, wrapped, `kek:${aad}`);
  }
}
