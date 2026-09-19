import type { Appointment, OrderSummary, Payment, PaymentIntentView } from "@/lib/consumer/api/types";
import { paymentSettled } from "@/lib/consumer/money";

export function mockIntentBody(appointmentId: string) {
  return { appointment_id: appointmentId, provider: "mock" as const };
}

export function payhereIntentBody(appointmentId: string, returnUrl?: string) {
  return {
    appointment_id: appointmentId,
    provider: "payhere" as const,
    ...(returnUrl ? { return_url: returnUrl } : {}),
  };
}

export function paymentStatus(
  intent: PaymentIntentView | null,
  payment: Payment | null,
): string | undefined {
  return payment?.status || intent?.payment?.status;
}

export function consultationTotal(
  order: OrderSummary | null,
  appointment: Appointment | null,
): number | undefined {
  return order?.total_cents ?? order?.consultation_fee_cents ?? appointment?.amount_cents;
}

export function isPaymentAuthorized(
  intent: PaymentIntentView | null,
  payment: Payment | null,
): boolean {
  return paymentStatus(intent, payment) === "authorized";
}

export function shouldGoToWaitingRoom(
  intent: PaymentIntentView | null,
  payment: Payment | null,
): boolean {
  return paymentSettled(paymentStatus(intent, payment), intent?.next_action);
}

export function waitingRoomPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/waiting-room`;
}
