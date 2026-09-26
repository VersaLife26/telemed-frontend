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

/** After checkout the visit is booked; join from the list when it is time. */
export function afterPaymentPath(): string {
  return "/appointments";
}
