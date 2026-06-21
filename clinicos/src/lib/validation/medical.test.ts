import { test } from "node:test";
import assert from "node:assert/strict";
import {
  medicalRecordSchema,
  prescriptionSchema,
  appointmentSchema,
} from "./medical";

test("السجل الطبي: يحوّل الفراغات إلى null", () => {
  const r = medicalRecordSchema.safeParse({
    chronic_diseases: "",
    allergies: "بنسلين",
    past_surgeries: "",
    current_medications: "",
    notes: "",
  });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.chronic_diseases, null);
    assert.equal(r.data.allergies, "بنسلين");
  }
});

test("الوصفة: تتطلّب دواءً واحداً على الأقل باسم صالح", () => {
  const ok = prescriptionSchema.safeParse({
    patient_id: "11111111-1111-1111-1111-111111111111",
    medications: [{ name: "باراسيتامول", dose: "500mg", frequency: "مرتين" }],
  });
  assert.equal(ok.success, true);

  const empty = prescriptionSchema.safeParse({
    patient_id: "11111111-1111-1111-1111-111111111111",
    medications: [],
  });
  assert.equal(empty.success, false);
});

test("الموعد: يتطلّب مريضاً ووقتاً", () => {
  const ok = appointmentSchema.safeParse({
    patient_id: "11111111-1111-1111-1111-111111111111",
    doctor_id: "",
    scheduled_at: "2026-07-01T10:00",
    notes: "",
  });
  assert.equal(ok.success, true);
  if (ok.success) assert.equal(ok.data.doctor_id, null);

  const bad = appointmentSchema.safeParse({
    patient_id: "not-a-uuid",
    scheduled_at: "",
  });
  assert.equal(bad.success, false);
});
