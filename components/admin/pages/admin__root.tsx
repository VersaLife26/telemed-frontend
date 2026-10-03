import type { Metadata } from "next";
import { CalendarCheck, Coins, Percent, Stethoscope, UserRound } from "lucide-react";

import { RankedBars } from "@/components/admin/charts/ranked-bars";
import { StatTile } from "@/components/admin/charts/stat-tile";
import { DashboardBookingsChart, DashboardRevenueChart } from "@/components/admin/dashboard/dashboard-charts";
import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { DashboardRangeControls } from "@/components/admin/dashboard/range-picker-links";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryGetServer } from "@/lib/admin/api/server";
import {
  matchingPresetDays,
  resolveDashboardRange,
} from "@/lib/admin/dashboard/date-range";
import type { BookingsDay, DashboardSummary, RevenuePoint, TopDoctor } from "@/lib/admin/api/types";
import { formatCount, formatDate, formatMoney, formatPercent } from "@/lib/admin/format";

const metadata: Metadata = { title: "Dashboard" };

export const dynamic = "force-dynamic";

/**
 * The dashboard.
 *
 * A server component: this is four aggregate reads that nobody interacts with
 * beyond changing the date range, and the range lives in the URL (`from` /
 * `to` as ISO dates in Asia/Colombo). Fetching on the server means the first
 * paint is the data rather than four skeletons and a waterfall of client
 * requests. None of it touches clinical content.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; days?: string }>;
}) {
  const params = await searchParams;
  const { from, to } = resolveDashboardRange(params);
  const activePreset = matchingPresetDays(from, to);

  const range = query({ from, to });

  const [result, revenueResult, bookingsResult, doctorsResult] = await Promise.all([
    tryGetServer<DashboardSummary>(endpoints.analytics.dashboard(range)),
    tryGetServer<RevenuePoint[]>(endpoints.analytics.revenue(range)),
    tryGetServer<BookingsDay[]>(endpoints.analytics.bookings(range)),
    tryGetServer<TopDoctor[]>(endpoints.analytics.topDoctors(query({ from, to, limit: 10 }))),
  ]);

  const rangeDescription =
    from === to ? (
      <>Platform activity for {formatDate(from)}.</>
    ) : activePreset ? (
      <>
        Platform activity for the last {activePreset} days, to {formatDate(to)}.
      </>
    ) : (
      <>
        Platform activity from {formatDate(from)} to {formatDate(to)}.
      </>
    );

  const header = (
    <PageHeader
      title="Dashboard"
      description={
        <>
          {rangeDescription} All figures are aggregates; no consultation content is available in
          this console.
        </>
      }
      actions={<DashboardRangeControls from={from} to={to} activePreset={activePreset} />}
    />
  );

  if (!result.ok) {
    const error = routeFatal(result.error);
    return (
      <>
        {header}
        <ErrorState error={error} what="the dashboard" />
      </>
    );
  }

  const summary = result.data;
  const currency = summary.currency || "LKR";

  const revenue = revenueResult.ok ? revenueResult.data : [];
  const bookingsDaily = bookingsResult.ok ? bookingsResult.data : [];
  const topDoctors = doctorsResult.ok ? doctorsResult.data : [];
  const noShowRate = summary.bookings > 0 ? summary.noShows / summary.bookings : 0;

  return (
    <>
      {header}

      <section
        aria-label="Headline figures"
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        <StatTile
          label="Gross revenue"
          value={formatMoney(summary.grossRevenueCents, currency)}
          hint={`Commission ${formatMoney(summary.commissionCents, currency)}`}
          icon={Coins}
        />
        <StatTile
          label="Bookings"
          value={formatCount(summary.bookings)}
          hint={`${formatCount(summary.completed)} completed`}
          icon={CalendarCheck}
        />
        <StatTile label="New patients" value={formatCount(summary.newPatients)} icon={UserRound} />
        <StatTile
          label="No-show rate"
          value={formatPercent(noShowRate)}
          hint="Of all bookings"
          icon={Percent}
          tone={noShowRate > 0.15 ? "warning" : "default"}
        />
        <StatTile
          label="Active doctors"
          value={formatCount(summary.activeDoctors)}
          icon={Stethoscope}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardRevenueChart points={revenue} currency={currency} />
        <DashboardBookingsChart points={bookingsDaily} />

        <RankedBars
          title="Top doctors"
          description="Completed consultations over the selected range."
          items={topDoctors.map((row) => ({
            key: row.doctorId,
            label: row.displayName,
            note: formatMoney(row.netCents, currency),
            value: row.completed,
          }))}
          emptyLabel="No completed consultations in this range."
        />
      </div>
    </>
  );
}
