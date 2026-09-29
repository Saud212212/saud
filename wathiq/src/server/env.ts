import os from "node:os";
import { z } from "zod";

/** كل الإعدادات من متغيرات البيئة، مُتحقق منها مرة واحدة. */
const schema = z.object({
  DATABASE_URL: z.string().url(), // دور wathiq_app (ليس مالك الجداول)
  KEYSTORE_DATABASE_URL: z.string().url().optional(), // افتراضياً = DATABASE_URL
  MIGRATION_DATABASE_URL: z.string().url().optional(), // دور wathiq_owner

  // المفتاح الرئيسي (KEK): "kid:base64(32 bytes)"، مفصولة بفواصل لدعم التدوير.
  // أول مفتاح هو النشط للتغليف؛ البقية للفك فقط.
  WATHIQ_MASTER_KEYS: z.string().min(10),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".data/storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("wathiq"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true"),

  SESSION_SECRET: z.string().min(16),

  OCR_ENGINE: z.enum(["tesseract"]).default("tesseract"),
  OCR_LANGS: z.string().default("ara+eng"),
  OCR_DPI: z.coerce.number().default(300),
  // مجلد نماذج tessdata_best (أدق بوضوح للعربية من النماذج المرفقة بحزم النظام)
  OCR_TESSDATA_DIR: z.string().optional(),
  OCR_PSM: z.coerce.number().default(3),
  OCR_LOW_CONFIDENCE: z.coerce.number().default(70),
  // أرقام صفحات OCR: all = كلها تحتاج مراجعة (افتراضي)، low = ضعيفة الثقة فقط
  OCR_NUMBERS_REVIEW: z.enum(["all", "low"]).default("all"),
  OCR_CONCURRENCY: z.coerce.number().default(Math.max(1, Math.min(4, os.cpus().length))),

  MAX_UPLOAD_MB: z.coerce.number().default(200),
  WORKER_POLL_MS: z.coerce.number().default(1000),
});

export type Env = z.infer<typeof schema>;

/** يعرّف قاعدة بياناتين بالمضيف والمنفذ واسم القاعدة (بغض النظر عن المستخدم). */
function sameDatabase(a: string, b: string) {
  const ua = new URL(a);
  const ub = new URL(b);
  const key = (u: URL) => `${u.hostname.toLowerCase()}:${u.port || "5432"}/${u.pathname.replace(/^\//, "")}`;
  return key(ua) === key(ub);
}

/**
 * قيود الإنتاج: مخزن المفاتيح في قاعدة مستقلة (قرار معتمد) — وإلا لا يشمل الحذف النهائي
 * النسخ الاحتياطية للقاعدة الرئيسية إلا بعد انتهاء مدة احتفاظها. انظر docs/security.md.
 */
export function assertProductionConfig(e: Env, nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv !== "production") return;
  if (!e.KEYSTORE_DATABASE_URL) {
    throw new Error("production requires KEYSTORE_DATABASE_URL (a separate database with short backup retention)");
  }
  if (sameDatabase(e.KEYSTORE_DATABASE_URL, e.DATABASE_URL)) {
    throw new Error("production requires KEYSTORE_DATABASE_URL to point to a different database than DATABASE_URL");
  }
}

let cached: Env | undefined;
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        "Invalid environment:\n" +
          parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"),
      );
    }
    assertProductionConfig(parsed.data);
    cached = parsed.data;
  }
  return cached;
}

/** للاختبارات فقط. */
export function resetEnvCache() {
  cached = undefined;
}
