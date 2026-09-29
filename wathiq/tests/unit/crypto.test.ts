import { describe, expect, it } from "vitest";
import { decryptBytes, decryptJson, encryptBytes, encryptJson, EnvKeyWrapper, newDataKey } from "@/server/crypto/envelope";

describe("envelope encryption", () => {
  it("round-trips bytes and JSON", () => {
    const k = newDataKey();
    const enc = encryptBytes(k, Buffer.from("كراسة الشروط"), "page:x:1");
    expect(decryptBytes(k, enc, "page:x:1").toString()).toBe("كراسة الشروط");
    const j = encryptJson(k, { text: "نص", words: [] }, "a");
    expect(decryptJson(k, j, "a")).toEqual({ text: "نص", words: [] });
  });

  it("ciphertext does not contain the plaintext and uses a fresh IV", () => {
    const k = newDataKey();
    const a = encryptBytes(k, Buffer.from("ضمان ابتدائي"), "a");
    const b = encryptBytes(k, Buffer.from("ضمان ابتدائي"), "a");
    expect(a.equals(b)).toBe(false);
    expect(a.includes(Buffer.from("ضمان"))).toBe(false);
  });

  it("fails with the wrong key, wrong AAD, or tampered data", () => {
    const k = newDataKey();
    const enc = encryptBytes(k, Buffer.from("secret"), "page:a:1");
    expect(() => decryptBytes(newDataKey(), enc, "page:a:1")).toThrow();
    expect(() => decryptBytes(k, enc, "page:a:2")).toThrow(); // لا يمكن نقل نص مشفّر لصفحة أخرى
    const tampered = Buffer.from(enc);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decryptBytes(k, tampered, "page:a:1")).toThrow();
  });

  it("wraps DEKs with the active master key and supports rotation", async () => {
    const old = new EnvKeyWrapper("k1:" + Buffer.alloc(32, 1).toString("base64"));
    const dek = newDataKey();
    const w1 = await old.wrap(dek, "tender:t1");
    const rotated = new EnvKeyWrapper(`k2:${Buffer.alloc(32, 2).toString("base64")},k1:${Buffer.alloc(32, 1).toString("base64")}`);
    expect(rotated.activeKekId).toBe("k2");
    expect((await rotated.unwrap(w1.kekId, w1.wrapped, "tender:t1")).equals(dek)).toBe(true);
    await expect(rotated.unwrap(w1.kekId, w1.wrapped, "tender:t2")).rejects.toThrow();
    expect(() => new EnvKeyWrapper("k1:short")).toThrow();
  });
});
