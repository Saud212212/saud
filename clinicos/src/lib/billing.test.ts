import { test } from "node:test";
import assert from "node:assert/strict";
import { isSubscriptionActive } from "./subscription";
import { computeInvoiceTotal } from "./validation/invoices";

test("الاشتراك الفعّال: active و trialing فقط", () => {
  assert.equal(isSubscriptionActive("active"), true);
  assert.equal(isSubscriptionActive("trialing"), true);
  assert.equal(isSubscriptionActive("past_due"), false);
  assert.equal(isSubscriptionActive("canceled"), false);
  assert.equal(isSubscriptionActive(null), false);
  assert.equal(isSubscriptionActive(undefined), false);
});

test("حساب إجمالي الفاتورة من البنود", () => {
  const total = computeInvoiceTotal([
    { description: "كشف", quantity: 1, unit_price: 100 },
    { description: "تحاليل", quantity: 2, unit_price: 49.5 },
  ]);
  assert.equal(total, 199);
});

test("إجمالي فاتورة فارغة = 0", () => {
  assert.equal(computeInvoiceTotal([]), 0);
});
