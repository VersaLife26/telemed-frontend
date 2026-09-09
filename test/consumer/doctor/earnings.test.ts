import assert from "node:assert/strict";
import test from "node:test";

import type { Payment, Payout } from "@/lib/consumer/api/types";
import { netPayoutCents, periodLabel, summarizeEarnings } from "@/lib/consumer/features/earnings";

test("periodLabel formats a date range or a dash", () => {
  assert.equal(periodLabel(), "—");
  assert.equal(periodLabel("2026-09-01T00:00:00Z", "2026-09-07T00:00:00Z"), "2026-09-01 → 2026-09-07");
  assert.equal(periodLabel("2026-09-01T00:00:00Z"), "2026-09-01 → ?");
});

test("netPayoutCents subtracts clawed payout from the doctor share", () => {
  const payment: Payment = { id: "p1", doctor_payout_cents: 80000, refunded_payout_cents: 10000 };
  assert.equal(netPayoutCents(payment), 70000);
  assert.equal(netPayoutCents({ id: "p2" }), 0);
});

test("summarizeEarnings splits paid batches from pending and sums net earned", () => {
  const payouts: Payout[] = [
    { id: "b1", status: "paid", amount_cents: 50000, currency: "LKR" },
    { id: "b2", status: "pending", amount_cents: 20000, currency: "LKR" },
    { id: "b3", status: "processing", amount_cents: 10000, currency: "LKR" },
    { id: "b4", status: "failed", amount_cents: 999, currency: "LKR" },
  ];
  const payments: Payment[] = [
    { id: "p1", doctor_payout_cents: 80000, refunded_payout_cents: 5000, currency: "LKR" },
    { id: "p2", doctor_payout_cents: 40000, currency: "LKR" },
  ];
  assert.deepEqual(summarizeEarnings(payouts, payments), {
    currency: "LKR",
    paid: 50000,
    pending: 30000,
    earned: 115000,
  });
});

test("summarizeEarnings defaults currency to LKR when both lists are empty", () => {
  assert.deepEqual(summarizeEarnings([], []), { currency: "LKR", paid: 0, pending: 0, earned: 0 });
});
