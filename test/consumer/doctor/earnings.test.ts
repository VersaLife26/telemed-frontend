import assert from "node:assert/strict";
import test from "node:test";

import type { DoctorEarnings } from "@/lib/consumer/api/types";
import { payoutStatusLabel, periodLabel, summarizeEarnings } from "@/lib/consumer/features/earnings";

test("periodLabel formats a date range or a dash", () => {
  assert.equal(periodLabel(), "—");
  assert.equal(periodLabel("2026-09-01T00:00:00Z", "2026-09-07T00:00:00Z"), "2026-09-01 → 2026-09-07");
  assert.equal(periodLabel("2026-09-01"), "2026-09-01 → ?");
});

test("summarizeEarnings maps the earnings figures", () => {
  const earnings: DoctorEarnings = {
    from: "2026-09-01",
    to: "2026-09-30",
    payments: 4,
    grossCents: 100000,
    refundedCents: 5000,
    commissionCents: 15000,
    providerFeeCents: 3000,
    netCents: 77000,
    pendingPayoutCents: 27000,
    paidCents: 50000,
    currency: "LKR",
  };
  assert.deepEqual(summarizeEarnings(earnings), {
    currency: "LKR",
    earned: 77000,
    paid: 50000,
    pending: 27000,
    gross: 100000,
    refunded: 5000,
    commission: 15000,
    providerFee: 3000,
  });
});

test("summarizeEarnings defaults to zero LKR before earnings load", () => {
  assert.deepEqual(summarizeEarnings(null), {
    currency: "LKR",
    earned: 0,
    paid: 0,
    pending: 0,
    gross: 0,
    refunded: 0,
    commission: 0,
    providerFee: 0,
  });
});

test("payout statuses read as sentences", () => {
  assert.equal(payoutStatusLabel("pending"), "Awaiting transfer");
  assert.equal(payoutStatusLabel("paid"), "Paid");
  assert.equal(payoutStatusLabel("failed"), "Transfer failed");
  assert.equal(payoutStatusLabel(undefined), "—");
});
