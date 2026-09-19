"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, OrderSummary, Payment, PaymentIntentView } from "@/lib/consumer/api/types";
import {
  afterPaymentPath,
  consultationTotal,
  isPaymentAuthorized,
  mockIntentBody,
  payhereIntentBody,
  paymentStatus,
  shouldGoToWaitingRoom,
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

  const goAppointments = useCallback(() => {
    router.push(afterPaymentPath());
  }, [router]);

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
  }, [appointmentId, intent, order?.payment_id, payment, polling, searchParams]);

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
        goAppointments();
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
        goAppointments();
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
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <h1 className="text-h2 text-ink">Payment</h1>

      {/* The amount is the largest thing on the screen. Everything below it is
          about how it gets paid, which matters less than what it is. */}
      <Card variant="tint" className="p-5">
        <p className="text-eyebrow text-brand">Consultation fee</p>
        <p className="mt-2 text-h1 text-ink tabular-time">{formatMoney(total, currency)}</p>
        {order?.discount_cents ? (
          <p className="mt-1 text-body-sm text-muted tabular-time">
            Discount {formatMoney(order.discount_cents, currency)}
          </p>
        ) : null}
      </Card>

      {authorized ? (
        <Alert tone="info" title="Card pre-authorised">
          {formatMoney(total, currency)} is held on your card. You are only charged after the
          consultation is completed.
        </Alert>
      ) : settled ? (
        <Alert tone="success" title="Payment confirmed">
          Your appointment is confirmed. Join from Appointments when it is time.
        </Alert>
      ) : (
        <Card className="flex gap-3 p-5">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tint text-brand"
          >
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-body font-semibold text-ink">Pay with card (PayHere)</p>
            <p className="mt-1 text-body-sm text-muted">
              Visa and Mastercard supported. Funds are held on the card and charged once the doctor
              completes your visit.
            </p>
          </div>
        </Card>
      )}

      {paymentStatus(intent, payment) ? (
        <p className="text-body-sm text-muted" role="status">
          Status: {paymentStatus(intent, payment)}
          {polling ? " · waiting for confirmation…" : ""}
        </p>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {settled ? (
        <Button size="lg" fullWidth onClick={goAppointments}>
          View appointment
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <Button size="lg" fullWidth busy={loading || polling} onClick={() => void payPayHere()}>
            {loading ? "Redirecting…" : polling ? "Verifying authorisation…" : "Pay with card"}
          </Button>
          <Button
            variant="outline"
            fullWidth
            busy={loading || polling}
            onClick={() => void payMock()}
          >
            Pay with mock (test)
          </Button>
        </div>
      )}

      {polling ? (
        <p className="text-body-sm text-muted">
          Waiting for confirmation from PayHere. This updates on its own once your card is
          authorised.
        </p>
      ) : null}
    </div>
  );
}
