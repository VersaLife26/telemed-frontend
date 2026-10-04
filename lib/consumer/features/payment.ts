import type { OrderSummary, PaymentProvider } from "@/lib/consumer/api/types";

export function orderPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/payment`;
}

export function promoPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/payment/promo`;
}

export function intentPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/payment/intent`;
}

export function intentBody(provider: PaymentProvider) {
  return { provider };
}

export function mockCompletePath(paymentId: string): string {
  return `/payments/${paymentId}/mock/complete`;
}

/** Promo codes lock once checkout has started. */
export function canChangePromo(order: Pick<OrderSummary, "status" | "intentCreated">): boolean {
  return order.status === "pending" && !order.intentCreated;
}

export function isPaymentAuthorized(order: Pick<OrderSummary, "status"> | null): boolean {
  return order?.status === "authorized";
}

/** Copy for the PayHere card, matching whether this visit will be held or charged now. */
export function payHereNotice(cardHold: boolean): string {
  return cardHold
    ? "Visa and Mastercard supported. Funds are held on the card and charged once the doctor completes your visit."
    : "Visa and Mastercard supported. The card is charged now. The appointment is confirmed when PayHere accepts the payment.";
}

/** After checkout the visit is booked; join from the list when it is time. */
export function afterPaymentPath(): string {
  return "/appointments";
}
