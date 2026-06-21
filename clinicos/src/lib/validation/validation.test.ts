import { test } from "node:test";
import assert from "node:assert/strict";
import { clinicOnboardingSchema } from "./onboarding";
import { staffCreateSchema } from "./staff";
import { patientSchema } from "./patients";

test("onboarding: يقبل مدخلات صحيحة", () => {
  const r = clinicOnboardingSchema.safeParse({
    clinic_name: "عيادة النور",
    slug: "al-noor",
    plan: "pro",
    admin_full_name: "سعود",
    admin_email: "Admin@Test.com",
    admin_password: "secret123",
  });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.slug, "al-noor");
    assert.equal(r.data.admin_email, "admin@test.com"); // يُحوّل لحروف صغيرة
  }
});

test("onboarding: يرفض slug غير صالح وكلمة مرور قصيرة", () => {
  const r = clinicOnboardingSchema.safeParse({
    clinic_name: "ع",
    slug: "Bad Slug!",
    admin_full_name: "س",
    admin_email: "not-an-email",
    admin_password: "123",
  });
  assert.equal(r.success, false);
});

test("staffCreate: يقبل الأدوار المسموح بها فقط (لا super_admin)", () => {
  const ok = staffCreateSchema.safeParse({
    full_name: "طبيب",
    email: "d@test.com",
    role: "doctor",
    password: "secret123",
  });
  assert.equal(ok.success, true);

  const bad = staffCreateSchema.safeParse({
    full_name: "مخترق",
    email: "x@test.com",
    role: "super_admin",
    password: "secret123",
  });
  assert.equal(bad.success, false);
});

test("patient: يحوّل الحقول الفارغة إلى null ويتحقق من العمر", () => {
  const r = patientSchema.safeParse({
    full_name: "مريض",
    phone: "",
    email: "",
    gender: "",
    age: "",
    date_of_birth: "",
    address: "",
  });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.phone, null);
    assert.equal(r.data.age, null);
  }

  const bad = patientSchema.safeParse({ full_name: "x", age: "999" });
  assert.equal(bad.success, false);
});
