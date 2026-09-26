import type { DoctorEarnings, Payout } from "@/lib/consumer/api/types";

export function periodLabel(start?: string, end?: string): string {
  if (!start && !end) return "—";
  const a = start ? start.slice(0, 10) : "?";
  const b = end ? end.slice(0, 10) : "?";
  return `${a} → ${b}`;
}

export function payoutStatusLabel(status?: Payout["status"]): string {
  switch (status) {
    case "pending":
      return "Awaiting transfer";
    case "paid":
      return "Paid";
    case "failed":
      return "Transfer failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "—";
  }
}

export function summarizeEarnings(earnings: DoctorEarnings | null) {
  return {
    currency: earnings?.currency || "LKR",
    earned: earnings?.netCents ?? 0,
    paid: earnings?.paidCents ?? 0,
    pending: earnings?.pendingPayoutCents ?? 0,
    gross: earnings?.grossCents ?? 0,
    refunded: earnings?.refundedCents ?? 0,
    commission: earnings?.commissionCents ?? 0,
    providerFee: earnings?.providerFeeCents ?? 0,
  };
}
