import { describe, expect, it } from "vitest";
import {
  assertDevLoginEnabled,
  decodeDevSession,
  devLoginEnabled,
  DevLoginDisabledError,
  encodeDevSession,
} from "@/server/auth/dev-login";
import { assertProductionConfig, type Env } from "@/server/env";

const SECRET = "test-secret-0123456789";
const dev = { NODE_ENV: "development", DEV_LOGIN: "true" };
const prod = { NODE_ENV: "production", DEV_LOGIN: "true" };

describe("dev login is disabled in production", () => {
  it("is enabled only outside production AND with DEV_LOGIN=true", () => {
    expect(devLoginEnabled(dev)).toBe(true);
    expect(devLoginEnabled({ NODE_ENV: "test", DEV_LOGIN: "true" })).toBe(true);
    expect(devLoginEnabled({ NODE_ENV: "development" })).toBe(false);
    // حتى لو ضُبط DEV_LOGIN=true خطأً في الإنتاج
    expect(devLoginEnabled(prod)).toBe(false);
    expect(() => assertDevLoginEnabled(prod)).toThrow(DevLoginDisabledError);
  });

  it("cannot mint a session in production", () => {
    expect(() => encodeDevSession(SECRET, "u1", prod)).toThrow(DevLoginDisabledError);
  });

  it("rejects a valid dev session cookie when running in production", () => {
    const token = encodeDevSession(SECRET, "7a1c0000-0000-4000-8000-000000000001", dev);
    expect(decodeDevSession(SECRET, token, dev)).toBe("7a1c0000-0000-4000-8000-000000000001");
    expect(decodeDevSession(SECRET, token, prod)).toBeNull();
  });

  it("rejects tampered or foreign-secret tokens", () => {
    const token = encodeDevSession(SECRET, "u1", dev);
    expect(decodeDevSession("another-secret-000000", token, dev)).toBeNull();
    expect(decodeDevSession(SECRET, token.replace("u1", "u2"), dev)).toBeNull();
    expect(decodeDevSession(SECRET, "u1.bogus", dev)).toBeNull();
  });

  it("the server action refuses in production", async () => {
    const saved = { ...process.env };
    try {
      Object.assign(process.env, prod);
      const { devLogin } = await import("@/app/actions");
      const fd = new FormData();
      fd.set("userId", "7a1c0000-0000-4000-8000-000000000001");
      await expect(devLogin(fd)).rejects.toBeInstanceOf(DevLoginDisabledError);
    } finally {
      process.env = saved;
    }
  });
});

describe("keystore must be a separate database in production", () => {
  const base = { DATABASE_URL: "postgresql://wathiq_app:x@db.internal:5432/wathiq" } as Env;
  it("requires KEYSTORE_DATABASE_URL", () => {
    expect(() => assertProductionConfig(base, "production")).toThrow(/KEYSTORE_DATABASE_URL/);
    expect(() => assertProductionConfig(base, "development")).not.toThrow();
  });
  it("rejects the same database under another user or default port", () => {
    const same = { ...base, KEYSTORE_DATABASE_URL: "postgresql://other:y@DB.internal/wathiq" } as Env;
    expect(() => assertProductionConfig(same, "production")).toThrow(/different database/);
  });
  it("accepts a different database", () => {
    const ok = { ...base, KEYSTORE_DATABASE_URL: "postgresql://wathiq_app:x@keys.internal:5432/wathiq_keys" } as Env;
    expect(() => assertProductionConfig(ok, "production")).not.toThrow();
  });
});
