"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/consumer/layout/AppShell";
import { browserApi } from "@/lib/consumer/api/client";
import {
  type DoctorEarnings,
  summarizePracticeEarnings,
} from "@/lib/consumer/features/practice";
import { periodLabel } from "@/lib/consumer/features/earnings";
import { formatMoney } from "@/lib/consumer/money";

export function EarningsClient() {
  const [earnings, setEarnings] = useState<DoctorEarnings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await browserApi<DoctorEarnings>("/doctors/me/earnings");
        if (!cancelled) setEarnings(data);
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

  const totals = useMemo(
    () => summarizePracticeEarnings(earnings ?? {}),
    [earnings],
  );
  const payouts = earnings?.payouts ?? [];

  if (loading) {
    return <p className="text-body text-text-muted">Loading earnings…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-h4 text-black">Earnings</h1>
      <p className="text-body-sm text-text-muted">
        {earnings?.from && earnings?.to
          ? `${periodLabel(earnings.from, earnings.to)}${earnings.timezone ? ` · ${earnings.timezone}` : ""}`
          : "Settled consults from your practice ledger."}
      </p>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-body-sm text-text-label">Earned (net)</p>
          <p className="mt-2 text-h4 text-black">{formatMoney(totals.earned, totals.currency)}</p>
          <p className="mt-1 text-body-sm text-text-muted">{totals.status}</p>
        </Card>
        <Card>
          <p className="text-body-sm text-text-label">Paid out</p>
          <p className="mt-2 text-h4 text-black">{formatMoney(totals.paid, totals.currency)}</p>
        </Card>
        <Card>
          <p className="text-body-sm text-text-label">Unpaid</p>
          <p className="mt-2 text-h4 text-black">{formatMoney(totals.pending, totals.currency)}</p>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-body-sm text-text-label">Gross</p>
          <p className="mt-2 text-h5 text-black">{formatMoney(totals.gross, totals.currency)}</p>
        </Card>
        <Card>
          <p className="text-body-sm text-text-label">Commission</p>
          <p className="mt-2 text-h5 text-black">{formatMoney(totals.commission, totals.currency)}</p>
        </Card>
      </div>

      <h2 className="text-body font-medium text-black">Payout batches</h2>
      {payouts.length === 0 ? (
        <Card>
          <p className="text-body text-text-muted">
            No payout batches in this window yet. Finance settles captured consults on a cycle;
            this list fills after that job.
          </p>
        </Card>
      ) : (
        payouts.map((p) => (
          <Card
            key={p.payout_id}
            className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-body font-medium text-black">
                {formatMoney(p.amount_cents, p.currency || totals.currency)}
              </p>
              <p className="text-body-sm text-text-muted">
                {periodLabel(p.period_start, p.period_end)}
                {p.sent_at ? ` · sent ${p.sent_at.slice(0, 10)}` : ""}
              </p>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
