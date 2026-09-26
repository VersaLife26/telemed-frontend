import assert from "node:assert/strict";
import test from "node:test";

import {
  afterPaymentPath,
  canChangePromo,
  intentBody,
  intentPath,
  isPaymentAuthorized,
  mockCompletePath,
  orderPath,
  promoPath,
} from "@/lib/consumer/features/payment";

test("payment endpoints hang off the appointment", () => {
  assert.equal(orderPath("appt-1"), "/appointments/appt-1/payment");
  assert.equal(promoPath("appt-1"), "/appointments/appt-1/payment/promo");
  assert.equal(intentPath("appt-1"), "/appointments/appt-1/payment/intent");
  assert.equal(mockCompletePath("pay-1"), "/payments/pay-1/mock/complete");
});

test("intentBody names only the provider", () => {
  assert.deepEqual(intentBody("mock"), { provider: "mock" });
  assert.deepEqual(intentBody("payhere"), { provider: "payhere" });
});

test("promo codes can change only before checkout starts", () => {
  assert.equal(canChangePromo({ status: "pending", intentCreated: false }), true);
  assert.equal(canChangePromo({ status: "pending", intentCreated: true }), false);
  assert.equal(canChangePromo({ status: "succeeded", intentCreated: false }), false);
});

test("isPaymentAuthorized detects a card hold", () => {
  assert.equal(isPaymentAuthorized({ status: "authorized" }), true);
  assert.equal(isPaymentAuthorized({ status: "pending" }), false);
  assert.equal(isPaymentAuthorized(null), false);
});

test("afterPaymentPath is the appointments list, not the call lobby", () => {
  assert.equal(afterPaymentPath(), "/appointments");
});
