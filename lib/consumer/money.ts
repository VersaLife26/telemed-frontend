export function formatMoney(cents?: number | null, currency = "LKR") {
  if (cents == null) return "—";
  return `${currency} ${(cents / 100).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type QuotedDoctor = {
  feeCents?: number | null;
  currency?: string | null;
  foreignFeeCents?: number | null;
  foreignCurrency?: string | null;
};

/** Citizens and anonymous visitors see the LKR fee. A signed-in non-citizen sees the USD quote. */
export function quotedFee(doctor: QuotedDoctor, international: boolean) {
  if (!international) {
    return {
      cents: doctor.feeCents,
      currency: doctor.currency || "LKR",
      available: doctor.feeCents != null,
    };
  }
  if (doctor.foreignFeeCents == null || !doctor.foreignCurrency) {
    return { cents: null, currency: "USD", available: false };
  }
  return {
    cents: doctor.foreignFeeCents,
    currency: doctor.foreignCurrency,
    available: true,
  };
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
