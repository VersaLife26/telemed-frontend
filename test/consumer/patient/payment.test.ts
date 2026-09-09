import assert from "node:assert/strict";
import test from "node:test";

import type { Appointment, OrderSummary, Payment, PaymentIntentView } from "@/lib/consumer/api/types";
import {
  consultationTotal,
  mockIntentBody,
  paymentStatus,
  shouldGoToWaitingRoom,
  waitingRoomPath,
} from "@/lib/consumer/features/payment";

const appointment: Appointment = { id: "appt-1", amount_cents: 250000, currency: "LKR" };

test("mockIntentBody always uses the mock rail", () => {
  assert.deepEqual(mockIntentBody("appt-1"), { appointment_id: "appt-1", provider: "mock" });
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

test("shouldGoToWaitingRoom after mock settlement", () => {
  const settled: PaymentIntentView = {
    payment: { id: "pay-1", appointment_id: "appt-1", status: "succeeded" },
    next_action: "none",
  };
  assert.equal(shouldGoToWaitingRoom(settled, settled.payment), true);
  assert.equal(
    shouldGoToWaitingRoom(
      { payment: { id: "pay-1", appointment_id: "appt-1", status: "requires_action" }, next_action: "redirect" },
      null,
    ),
    false,
  );
});

test("waitingRoomPath is keyed by appointment id", () => {
  assert.equal(waitingRoomPath("appt-1"), "/appointments/appt-1/waiting-room");
});
