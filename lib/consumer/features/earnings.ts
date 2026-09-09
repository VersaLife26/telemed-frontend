import type { Payment, Payout } from "@/lib/consumer/api/types";

export function periodLabel(start?: string, end?: string): string {
  if (!start && !end) return "—";
  const a = start ? start.slice(0, 10) : "?";
  const b = end ? end.slice(0, 10) : "?";
  return `${a} → ${b}`;
}

export function netPayoutCents(payment: Payment): number {
  return (payment.doctor_payout_cents || 0) - (payment.refunded_payout_cents || 0);
}

export function summarizeEarnings(payouts: Payout[], payments: Payment[]) {
  const currency = payouts[0]?.currency || payments[0]?.currency || "LKR";
  const paid = payouts
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount_cents || 0), 0);
  const pending = payouts
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + (p.amount_cents || 0), 0);
  const earned = payments.reduce((sum, p) => sum + netPayoutCents(p), 0);
  return { currency, paid, pending, earned };
}
