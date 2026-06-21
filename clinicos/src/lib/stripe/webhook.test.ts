import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

// يختبر آلية التحقق من توقيع Stripe المستخدمة في مسار الويب هوك.
const stripe = new Stripe("sk_test_dummy_key_for_signature_tests");
const SECRET = "whsec_test_secret";

const payload = JSON.stringify({
  id: "evt_test",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test", metadata: { type: "invoice" } } },
});

test("webhook: التوقيع الصحيح يُقبل", () => {
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
  });
  const event = stripe.webhooks.constructEvent(payload, header, SECRET);
  assert.equal(event.type, "checkout.session.completed");
});

test("webhook: التوقيع بسرّ خاطئ يُرفض", () => {
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: "whsec_wrong_secret",
  });
  assert.throws(() => stripe.webhooks.constructEvent(payload, header, SECRET));
});

test("webhook: العبث بالجسم بعد التوقيع يُرفض", () => {
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
  });
  const tampered = payload.replace("invoice", "subscription");
  assert.throws(() => stripe.webhooks.constructEvent(tampered, header, SECRET));
});
