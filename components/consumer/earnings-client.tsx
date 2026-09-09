"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/consumer/layout/AppShell";
import { browserApi } from "@/lib/consumer/api/client";
import type { Payment, Payout } from "@/lib/consumer/api/types";
import { netPayoutCents, periodLabel, summarizeEarnings } from "@/lib/consumer/features/earnings";
import { formatMoney } from "@/lib/consumer/money";

export function EarningsClient() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, pay] = await Promise.all([
          browserApi<Payout[]>("/payouts?per_page=50"),
          browserApi<Payment[]>("/payments?per_page=50"),
        ]);
        if (cancelled) return;
        setPayouts(Array.isArray(p) ? p : []);
        setPayments(Array.isArray(pay) ? pay : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load earnings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => summarizeEarnings(payouts, payments), [payouts, payments]);

  if (loading) {
    return <p className="text-body text-text-muted">Loading earnings…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-h4 text-black">Earnings</h1>
      <p className="text-body-sm text-text-muted">
        Your share of settled consults and payout batches from payment-service.
      </p>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-body-sm text-text-label">Earned (net)</p>
          <p className="mt-2 text-h4 text-black">{formatMoney(totals.earned, totals.currency)}</p>
        </Card>
        <Card>
          <p className="text-body-sm text-text-label">Paid out</p>
          <p className="mt-2 text-h4 text-black">{formatMoney(totals.paid, totals.currency)}</p>
        </Card>
        <Card>
          <p className="text-body-sm text-text-label">In settlement</p>
          <p className="mt-2 text-h4 text-black">{formatMoney(totals.pending, totals.currency)}</p>
        </Card>
      </div>

      <h2 className="text-body font-medium text-black">Payout batches</h2>
      {payouts.length === 0 ? (
        <Card>
          <p className="text-body text-text-muted">
            No payout batches yet. Finance runs settlement on captured consults; this list fills after that job.
          </p>
        </Card>
      ) : (
        payouts.map((p) => (
          <Card key={p.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-body font-medium text-black">
                {formatMoney(p.amount_cents, p.currency || totals.currency)}
              </p>
              <p className="text-body-sm text-text-muted">
                {periodLabel(p.period_start, p.period_end)}
                {p.payment_count != null ? ` · ${p.payment_count} consults` : ""}
              </p>
            </div>
            <p className="text-body-sm text-text-label">
              {p.status || "—"}
              {p.failure_reason ? ` · ${p.failure_reason}` : ""}
            </p>
          </Card>
        ))
      )}

      <h2 className="text-body font-medium text-black">Consult ledger</h2>
      {payments.length === 0 ? (
        <Card>
          <p className="text-body text-text-muted">No payments attributed to you yet.</p>
        </Card>
      ) : (
        payments.map((p) => (
          <Card key={p.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-body font-medium text-black">
                {formatMoney(netPayoutCents(p), p.currency || totals.currency)}
              </p>
              <p className="text-body-sm text-text-muted">
                Charged {formatMoney(p.amount_cents, p.currency || totals.currency)}
                {p.created_at ? ` · ${p.created_at.slice(0, 10)}` : ""}
              </p>
            </div>
            <p className="text-body-sm text-text-label">
              {p.status || "—"}
              {p.payout_id ? " · in a payout" : ""}
            </p>
          </Card>
        ))
      )}
    </div>
  );
}
