"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, PiggyBank, Wallet } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Card } from "@/components/consumer/ui/Card";
import { StatCard } from "@/components/consumer/ui/StatCard";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { browserApi } from "@/lib/consumer/api/client";
import {
  type DoctorEarnings,
  summarizePracticeEarnings,
} from "@/lib/consumer/features/practice";
import { periodLabel } from "@/lib/consumer/features/earnings";
import { formatMoney } from "@/lib/consumer/money";
import { PageHero } from "@/components/consumer/ui/PageHero";
import { HEROES } from "@/lib/consumer/heroes";

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
    return (
      <div className="flex flex-col gap-10">
        <PageHero {...HEROES.earnings} />
        <div className="mx-auto w-full max-w-3xl">
          <FormSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHero
        {...HEROES.earnings}
        lede={
          earnings?.from && earnings?.to
            ? `${periodLabel(earnings.from, earnings.to)}${earnings.timezone ? ` · ${earnings.timezone}` : ""}`
            : "Settled consults from your practice ledger."
        }
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Wallet className="size-5" />}
          value={formatMoney(totals.earned, totals.currency)}
          label="Earned (net)"
          trend={totals.status}
        />
        <StatCard
          icon={<Banknote className="size-5" />}
          value={formatMoney(totals.paid, totals.currency)}
          label="Paid out"
        />
        <StatCard
          icon={<PiggyBank className="size-5" />}
          value={formatMoney(totals.pending, totals.currency)}
          label="Unpaid"
        />
      </div>

      {/* Gross and commission are the arithmetic behind the net figure above,
          so they sit together on one tinted card rather than competing with
          it as two more tiles. */}
      <Card variant="tint" className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-eyebrow text-brand">Gross</p>
          <p className="mt-1 text-h4 text-ink tabular-time">
            {formatMoney(totals.gross, totals.currency)}
          </p>
        </div>
        <div>
          <p className="text-eyebrow text-brand">Commission</p>
          <p className="mt-1 text-h4 text-ink tabular-time">
            {formatMoney(totals.commission, totals.currency)}
          </p>
        </div>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-h3 text-ink">Payout batches</h2>
        {payouts.length === 0 ? (
          <EmptyState
            title="No payouts in this window"
            body="Finance settles captured consults on a cycle; this list fills after that job runs."
            icon={<Banknote className="size-5" />}
          />
        ) : (
          <ul className="stagger flex flex-col gap-3">
            {payouts.map((p) => (
              <Card
                as="li"
                key={p.payout_id}
                className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-h5 text-ink tabular-time">
                  {formatMoney(p.amount_cents, p.currency || totals.currency)}
                </p>
                <p className="text-body-sm text-muted tabular-time">
                  {periodLabel(p.period_start, p.period_end)}
                  {p.sent_at ? ` · sent ${p.sent_at.slice(0, 10)}` : ""}
                </p>
              </Card>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}
