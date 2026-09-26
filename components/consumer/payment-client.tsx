"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { Input } from "@/components/consumer/ui/Input";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { browserApi } from "@/lib/consumer/api/client";
import type { OrderSummary, Payment, PaymentIntent } from "@/lib/consumer/api/types";
import {
  afterPaymentPath,
  canChangePromo,
  intentBody,
  intentPath,
  isPaymentAuthorized,
  mockCompletePath,
  orderPath,
  promoPath,
} from "@/lib/consumer/features/payment";
import { formatMoney, paymentSettled } from "@/lib/consumer/money";

type Checkout = NonNullable<PaymentIntent["checkout"]>;

/** PayHere's hosted page takes a form POST; the API hands us the signed fields. */
function submitCheckout(checkout: Checkout) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = checkout.actionUrl;
  form.style.display = "none";
  for (const [name, value] of Object.entries(checkout.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function PaymentClient({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [promo, setPromo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"payhere" | "mock" | "promo" | null>(null);
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
    browserApi<OrderSummary>(orderPath(appointmentId))
      .then((o) => {
        if (!cancelled) setOrder(o);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load order");
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const settled = paymentSettled(order?.status);

  useEffect(() => {
    if (!polling) return;
    if (settled) {
      setPolling(false);
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        setOrder(await browserApi<OrderSummary>(orderPath(appointmentId)));
      } catch {
        /* keep polling */
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [appointmentId, polling, settled]);

  const goAppointments = useCallback(() => {
    router.push(afterPaymentPath());
  }, [router]);

  async function payPayHere() {
    setError(null);
    setBusy("payhere");
    try {
      const intent = await browserApi<PaymentIntent>(intentPath(appointmentId), {
        method: "POST",
        body: intentBody("payhere"),
      });
      if (intent.checkout) {
        submitCheckout(intent.checkout);
        return;
      }
      if (paymentSettled(intent.status)) {
        goAppointments();
        return;
      }
      setPolling(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PayHere checkout failed");
    } finally {
      setBusy(null);
    }
  }

  async function payMock() {
    setError(null);
    setBusy("mock");
    try {
      const intent = await browserApi<PaymentIntent>(intentPath(appointmentId), {
        method: "POST",
        body: intentBody("mock"),
      });
      const payment = paymentSettled(intent.status)
        ? null
        : await browserApi<Payment>(mockCompletePath(intent.paymentId), {
            method: "POST",
            body: { outcome: "succeed" },
          });
      if (paymentSettled(payment?.status ?? intent.status)) {
        goAppointments();
        return;
      }
      setError("The test payment did not go through.");
      setOrder(await browserApi<OrderSummary>(orderPath(appointmentId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(null);
    }
  }

  async function changePromo(action: "apply" | "remove") {
    setError(null);
    setBusy("promo");
    try {
      const updated = await browserApi<OrderSummary>(promoPath(appointmentId), {
        method: action === "apply" ? "PUT" : "DELETE",
        body: action === "apply" ? { code: promo.trim() } : undefined,
      });
      setOrder(updated);
      setPromo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the promo code");
    } finally {
      setBusy(null);
    }
  }

  if (hydrating) {
    return <FormSkeleton />;
  }

  const currency = order?.currency || "LKR";
  const authorized = isPaymentAuthorized(order);
  const providers = order?.availableProviders ?? [];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <h1 className="text-h2 text-ink">Payment</h1>

      {/* The amount is the largest thing on the screen. Everything below it is
          about how it gets paid, which matters less than what it is. */}
      <Card variant="tint" className="p-5">
        <p className="text-eyebrow text-brand">Consultation fee</p>
        <p className="mt-2 text-h1 text-ink tabular-time">{formatMoney(order?.amountCents, currency)}</p>
        {order?.discountCents ? (
          <p className="mt-1 text-body-sm text-muted tabular-time">
            {formatMoney(order.grossCents, currency)} less {formatMoney(order.discountCents, currency)}
            {order.promoCode ? ` (${order.promoCode})` : ""}
          </p>
        ) : null}
      </Card>

      {order && canChangePromo(order) ? (
        order.promoCode ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-body-sm text-muted">
              Promo code <span className="font-semibold text-ink">{order.promoCode}</span> applied.
            </p>
            <Button size="sm" variant="ghost" busy={busy === "promo"} onClick={() => void changePromo("remove")}>
              Remove
            </Button>
          </div>
        ) : (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void changePromo("apply");
            }}
          >
            <Input
              id="promo-code"
              label="Promo code"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              fieldClassName="flex-1"
            />
            <Button type="submit" variant="outline" busy={busy === "promo"} disabled={!promo.trim()}>
              Apply
            </Button>
          </form>
        )
      ) : null}

      {authorized ? (
        <Alert tone="info" title="Card pre-authorised">
          {formatMoney(order?.amountCents, currency)} is held on your card. You are only charged after
          the consultation is completed.
        </Alert>
      ) : settled ? (
        <Alert tone="success" title="Payment confirmed">
          Your appointment is confirmed. Join from Appointments when it is time.
        </Alert>
      ) : providers.includes("payhere") ? (
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
      ) : null}

      {order?.status ? (
        <p className="text-body-sm text-muted" role="status">
          Status: {order.status}
          {polling ? " · waiting for confirmation…" : ""}
        </p>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {settled ? (
        <Button size="lg" fullWidth onClick={goAppointments}>
          View appointment
        </Button>
      ) : order ? (
        <div className="flex flex-col gap-3">
          {providers.includes("payhere") ? (
            <Button
              size="lg"
              fullWidth
              busy={busy === "payhere" || polling}
              disabled={busy !== null}
              onClick={() => void payPayHere()}
            >
              {busy === "payhere" ? "Redirecting…" : polling ? "Verifying authorisation…" : "Pay with card"}
            </Button>
          ) : null}
          {providers.includes("mock") ? (
            <Button
              variant="outline"
              fullWidth
              busy={busy === "mock"}
              disabled={busy !== null || polling}
              onClick={() => void payMock()}
            >
              Pay with mock (test)
            </Button>
          ) : null}
        </div>
      ) : null}

      {polling ? (
        <p className="text-body-sm text-muted">
          Waiting for confirmation from PayHere. This updates on its own once your card is
          authorised.
        </p>
      ) : null}
    </div>
  );
}
