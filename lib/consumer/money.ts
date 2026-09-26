export function formatMoney(cents?: number | null, currency = "LKR") {
  if (cents == null) return "—";
  return `${currency} ${(cents / 100).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatWait(seconds?: number | null) {
  if (seconds == null || seconds <= 0) return "a few minutes";
  const m = Math.max(1, Math.round(seconds / 60));
  return `about ${m} min`;
}

/** A card hold (`authorized`) confirms the booking just as a capture does. */
export function paymentSettled(status?: string) {
  return status === "succeeded" || status === "authorized";
}
