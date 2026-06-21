import { test } from "node:test";
import assert from "node:assert/strict";
import { homePathForRole, isAppRole, ROLE_HOME } from "./rbac";

test("يوجّه كل دور إلى لوحته الصحيحة", () => {
  assert.equal(homePathForRole("super_admin"), "/admin");
  assert.equal(homePathForRole("clinic_admin"), "/dashboard");
  assert.equal(homePathForRole("doctor"), "/doctor");
  assert.equal(homePathForRole("receptionist"), "/reception");
});

test("الأدوار غير الصالحة تُوجَّه إلى تسجيل الدخول", () => {
  assert.equal(homePathForRole(null), "/login");
  assert.equal(homePathForRole(undefined), "/login");
  assert.equal(homePathForRole("hacker"), "/login");
});

test("isAppRole يتحقق من صحة الدور", () => {
  assert.equal(isAppRole("doctor"), true);
  assert.equal(isAppRole("nope"), false);
  assert.equal(isAppRole(null), false);
});

test("كل دور في ROLE_HOME له مسار فريد", () => {
  const paths = Object.values(ROLE_HOME);
  assert.equal(new Set(paths).size, paths.length);
});
