"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/consumer/ui/Card";
import { Button } from "@/components/consumer/ui/Button";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, OrderSummary, Payment, PaymentIntentView } from "@/lib/consumer/api/types";
import {
  consultationTotal,
  isPaymentAuthorized,
  mockIntentBody,
  payhereIntentBody,
  paymentStatus,
  shouldGoToWaitingRoom,
  waitingRoomPath,
} from "@/lib/consumer/features/payment";
import { formatMoney, paymentSettled } from "@/lib/consumer/money";

export function PaymentClient({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [intent, setIntent] = useState<PaymentIntentView | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    const payhereParam = searchParams.get("payhere");
    if (payhereParam === "cancelled") {
      setError("Payment authorization was cancelled. You can try again below.");
    } else if (payhereParam === "return" || searchParams.has("order_id")) {
      setPolling(true);
    }
  }, [searchParams]);

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
    const id = payment?.id || intent?.payment?.id || order?.payment_id;
    if (!polling && !searchParams.has("order_id") && searchParams.get("payhere") !== "return") return;
    if (shouldGoToWaitingRoom(intent, payment)) {
      setPolling(false);
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        if (id) {
          const latest = await browserApi<Payment>(`/payments/${id}`);
          setPayment(latest);
          if (paymentSettled(latest.status)) {
            setPolling(false);
          }
        } else {
          const ord = await browserApi<OrderSummary>(`/payments/order/${appointmentId}`).catch(() => null);
          if (ord?.payment_id) {
            const latest = await browserApi<Payment>(`/payments/${ord.payment_id}`);
            setPayment(latest);
            if (paymentSettled(latest.status)) {
              setPolling(false);
            }
          }
        }
      } catch {
        /* keep polling */
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [appointmentId, goWaiting, intent, order?.payment_id, payment, polling, searchParams]);

  async function payPayHere() {
    setError(null);
    setLoading(true);
    try {
      const returnUrl = `${window.location.origin}/appointments/${appointmentId}/payment?payhere=return`;
      const created = await browserApi<PaymentIntentView>("/payments/intent", {
        method: "POST",
        body: payhereIntentBody(appointmentId, returnUrl),
      });
      setIntent(created);
      setPayment(created.payment);

      if (paymentSettled(created.payment?.status, created.next_action)) {
        goWaiting();
        return;
      }

      if (created.next_action === "redirect" && created.redirect_url) {
        if (created.reference) {
          try {
            const fields = JSON.parse(created.reference) as Record<string, unknown>;
            const form = document.createElement("form");
            form.method = "POST";
            form.action = created.redirect_url;
            form.style.display = "none";

            for (const [key, value] of Object.entries(fields)) {
              if (value != null) {
                const input = document.createElement("input");
                input.type = "hidden";
                input.name = key;
                input.value = String(value);
                form.appendChild(input);
              }
            }
            document.body.appendChild(form);
            form.submit();
            return;
          } catch {
            window.location.href = created.redirect_url;
            return;
          }
        }
        window.location.href = created.redirect_url;
        return;
      }

      setPolling(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PayHere checkout failed");
    } finally {
      setLoading(false);
    }
  }

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
  const authorized = isPaymentAuthorized(intent, payment);

  if (hydrating) {
    return <FormSkeleton />;
  }

  return (
    <Card className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-h4 text-ink">Payment</h1>

      <div className="rounded-[16px] bg-linen p-4">
        <p className="text-body-sm text-text-muted">Consultation fee</p>
        <p className="text-h3 text-ink tabular-time">{formatMoney(total, currency)}</p>
        {order?.discount_cents ? (
          <p className="mt-1 text-body-sm text-text-muted">
            Discount {formatMoney(order.discount_cents, currency)}
          </p>
        ) : null}
      </div>

      {authorized ? (
        <div className="rounded-[16px] border border-blue-200 bg-blue-50 p-4 text-blue-900">
          <p className="text-body font-semibold">Card Pre-Authorized</p>
          <p className="mt-1 text-body-sm text-blue-800">
            {formatMoney(total, currency)} has been held on your card. You will only be
            charged after your consultation is completed.
          </p>
        </div>
      ) : settled ? (
        <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-body font-semibold">Payment Confirmed</p>
          <p className="mt-1 text-body-sm text-emerald-800">
            Your appointment is confirmed. You can proceed to the waiting room.
          </p>
        </div>
      ) : (
        <div className="rounded-[16px] border border-stone-200 bg-stone-50 p-4">
          <p className="text-body font-medium text-ink">Pay with Card (PayHere)</p>
          <p className="mt-1 text-body-sm text-text-muted">
            Visa and Mastercard supported. Funds are held on card and only charged once the
            doctor completes your visit.
          </p>
        </div>
      )}

      {paymentStatus(intent, payment) ? (
        <p className="text-body-sm text-text-muted">
          Status: {paymentStatus(intent, payment)}
          {polling ? " · waiting for confirmation…" : ""}
        </p>
      ) : null}

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      {settled ? (
        <Button type="button" fullWidth onClick={goWaiting}>
          Continue to waiting room
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            fullWidth
            busy={loading || polling}
            onClick={() => void payPayHere()}
          >
            {loading ? "Redirecting…" : polling ? "Verifying authorization…" : "Pay with Card (PayHere)"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            busy={loading || polling}
            onClick={() => void payMock()}
          >
            Pay with mock (test)
          </Button>
        </div>
      )}

      {polling ? (
        <p className="text-body-sm text-text-muted">
          Waiting for confirmation from PayHere. This updates automatically once your card is authorized.
        </p>
      ) : null}
    </Card>
  );
}
