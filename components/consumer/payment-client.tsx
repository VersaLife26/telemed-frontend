"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/consumer/ui/Card";
import { Button } from "@/components/consumer/ui/Button";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, OrderSummary, Payment, PaymentIntentView } from "@/lib/consumer/api/types";
import {
  consultationTotal,
  mockIntentBody,
  paymentStatus,
  shouldGoToWaitingRoom,
  waitingRoomPath,
} from "@/lib/consumer/features/payment";
import { formatMoney, paymentSettled } from "@/lib/consumer/money";

export function PaymentClient({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [intent, setIntent] = useState<PaymentIntentView | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [o, a] = await Promise.all([
          browserApi<OrderSummary>(`/payments/order/${appointmentId}`).catch(() => null),
          browserApi<Appointment>(`/appointments/${appointmentId}`).catch(() => null),
        ]);
        if (!cancelled) {
          setOrder(o);
          setAppointment(a);
          setHydrating(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load order");
          setHydrating(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const goWaiting = useCallback(() => {
    router.push(waitingRoomPath(appointmentId));
  }, [appointmentId, router]);

  useEffect(() => {
    const id = payment?.id || intent?.payment?.id;
    if (!polling || !id) return;
    if (shouldGoToWaitingRoom(intent, payment)) {
      setPolling(false);
      goWaiting();
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        const latest = await browserApi<Payment>(`/payments/${id}`);
        setPayment(latest);
        if (paymentSettled(latest.status)) {
          setPolling(false);
          goWaiting();
        }
      } catch {
        /* keep polling */
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [goWaiting, intent, payment, polling]);

  async function payMock() {
    setError(null);
    setLoading(true);
    try {
      const created = await browserApi<PaymentIntentView>("/payments/intent", {
        method: "POST",
        body: mockIntentBody(appointmentId),
      });
      setIntent(created);
      setPayment(created.payment);
      if (paymentSettled(created.payment?.status, created.next_action)) {
        goWaiting();
        return;
      }
      setPolling(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  const total = consultationTotal(order, appointment);
  const currency = order?.currency || appointment?.currency || "LKR";
  const settled = shouldGoToWaitingRoom(intent, payment);

  if (hydrating) {
    return <FormSkeleton />;
  }

  return (
    <Card className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-h4 text-ink">Payment</h1>
      <p className="text-body text-text-muted">
        Test checkout uses the <span className="font-medium text-ink">mock</span> rail.
        No card is charged.
      </p>
      <div className="rounded-[16px] bg-linen p-4">
        <p className="text-body-sm text-text-muted">Consultation fee</p>
        <p className="text-h3 text-ink tabular-time">{formatMoney(total, currency)}</p>
        {order?.discount_cents ? (
          <p className="mt-1 text-body-sm text-text-muted">
            Discount {formatMoney(order.discount_cents, currency)}
          </p>
        ) : null}
      </div>
      {paymentStatus(intent, payment) ? (
        <p className="text-body-sm text-text-muted">
          Status: {paymentStatus(intent, payment)}
          {polling ? " · waiting for settlement…" : ""}
        </p>
      ) : null}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      {settled ? (
        <Button type="button" fullWidth onClick={goWaiting}>
          Continue to waiting room
        </Button>
      ) : (
        <Button type="button" fullWidth busy={loading || polling} onClick={() => void payMock()}>
          {loading ? "Starting…" : polling ? "Waiting for settlement…" : "Pay with mock"}
        </Button>
      )}
      {polling ? (
        <p className="text-body-sm text-text-muted">
          If this stays on requires_action, set MOCK_AUTO_SUCCEED=true on payment-service
          so the mock rail settles immediately.
        </p>
      ) : null}
    </Card>
  );
}
