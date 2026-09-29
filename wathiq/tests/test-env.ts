/** إعدادات بيئة الاختبار — مشتركة بين global-setup وملفات الاختبار. */
export const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5433/postgres";
export const TEST_DB = process.env.TEST_DATABASE_NAME ?? "wathiq_test";

function withDb(url: string, db: string, user?: string, pass?: string) {
  const u = new URL(url);
  u.pathname = `/${db}`;
  if (user) {
    u.username = user;
    u.password = pass ?? "";
  }
  return u.toString();
}

export const OWNER_URL = withDb(ADMIN_URL, TEST_DB, "wathiq_owner", "wathiq_owner_dev");
export const APP_URL = withDb(ADMIN_URL, TEST_DB, "wathiq_app", "wathiq_app_dev");
export const ADMIN_TEST_DB_URL = withDb(ADMIN_URL, TEST_DB);

export function applyTestEnv() {
  Object.assign(process.env, {
    DATABASE_URL: APP_URL,
    WATHIQ_MASTER_KEYS: "test1:" + Buffer.alloc(32, 7).toString("base64"),
    SESSION_SECRET: "test-session-secret-000",
    STORAGE_DRIVER: "local",
    STORAGE_LOCAL_DIR: ".data/test-storage",
    OCR_CONCURRENCY: "4",
  });
}
