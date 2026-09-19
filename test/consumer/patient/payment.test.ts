import assert from "node:assert/strict";
import test from "node:test";

import type { Appointment, OrderSummary, Payment, PaymentIntentView } from "@/lib/consumer/api/types";
import {
  afterPaymentPath,
  consultationTotal,
  isPaymentAuthorized,
  mockIntentBody,
  payhereIntentBody,
  paymentStatus,
  shouldGoToWaitingRoom,
} from "@/lib/consumer/features/payment";

const appointment: Appointment = { id: "appt-1", amount_cents: 250000, currency: "LKR" };

test("mockIntentBody always uses the mock rail", () => {
  assert.deepEqual(mockIntentBody("appt-1"), { appointment_id: "appt-1", provider: "mock" });
});

test("payhereIntentBody uses the payhere rail with optional return url", () => {
  assert.deepEqual(payhereIntentBody("appt-1"), { appointment_id: "appt-1", provider: "payhere" });
  assert.deepEqual(payhereIntentBody("appt-1", "https://patient.example.com/return"), {
    appointment_id: "appt-1",
    provider: "payhere",
    return_url: "https://patient.example.com/return",
  });
});

test("consultationTotal prefers order total then fee then appointment amount", () => {
  const order: OrderSummary = {
    consultation_fee_cents: 200000,
    total_cents: 180000,
  };
  assert.equal(consultationTotal(order, appointment), 180000);
  assert.equal(consultationTotal({ consultation_fee_cents: 200000 }, appointment), 200000);
  assert.equal(consultationTotal(null, appointment), 250000);
});

test("paymentStatus reads the payment first, then the intent", () => {
  const payment: Payment = { id: "pay-1", appointment_id: "appt-1", status: "succeeded" };
  const intent: PaymentIntentView = {
    payment: { id: "pay-1", appointment_id: "appt-1", status: "requires_action" },
    next_action: "redirect",
  };
  assert.equal(paymentStatus(intent, payment), "succeeded");
  assert.equal(paymentStatus(intent, null), "requires_action");
});

test("isPaymentAuthorized detects authorized payments", () => {
  const authorizedPayment: Payment = { id: "pay-1", appointment_id: "appt-1", status: "authorized" };
  const pendingPayment: Payment = { id: "pay-1", appointment_id: "appt-1", status: "pending" };
  assert.equal(isPaymentAuthorized(null, authorizedPayment), true);
  assert.equal(isPaymentAuthorized(null, pendingPayment), false);
});

test("shouldGoToWaitingRoom after settlement or card authorization", () => {
  const settled: PaymentIntentView = {
    payment: { id: "pay-1", appointment_id: "appt-1", status: "succeeded" },
    next_action: "none",
  };
  assert.equal(shouldGoToWaitingRoom(settled, settled.payment), true);

  const authorized: PaymentIntentView = {
    payment: { id: "pay-1", appointment_id: "appt-1", status: "authorized" },
    next_action: "none",
  };
  assert.equal(shouldGoToWaitingRoom(authorized, authorized.payment), true);

  assert.equal(
    shouldGoToWaitingRoom(
      { payment: { id: "pay-1", appointment_id: "appt-1", status: "requires_action" }, next_action: "redirect" },
      null,
    ),
    false,
  );
});

test("afterPaymentPath is the appointments list, not the call lobby", () => {
  assert.equal(afterPaymentPath(), "/appointments");
});
