import type { Metadata } from "next";
import { CalendarCheck, Coins, Percent, Stethoscope, UserRound } from "lucide-react";

import { RankedBars } from "@/components/admin/charts/ranked-bars";
import { StatTile } from "@/components/admin/charts/stat-tile";
import { DashboardBookingsChart, DashboardRevenueChart } from "@/components/admin/dashboard/dashboard-charts";
import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { RangePickerLinks } from "@/components/admin/dashboard/range-picker-links";
import { UtilisationTable } from "@/components/admin/dashboard/utilisation-table";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryGetServer } from "@/lib/admin/api/server";
import type { DashboardSummary, DoctorTotalsRow, RevenuePoint, BookingsPoint } from "@/lib/admin/api/types";
import { DISTRICTS, districtName } from "@/lib/admin/districts";
import { formatCount, formatDate, formatMoney, formatPercent, humanise } from "@/lib/admin/format";

const metadata: Metadata = { title: "Dashboard" };

export const dynamic = "force-dynamic";

/** Ranges the picker offers, in days. */
const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

/**
 * The dashboard.
 *
 * A server component: this is five aggregate reads that nobody interacts with
 * beyond changing the date range, and the range lives in the URL. Fetching on
 * the server means the first paint is the data rather than five skeletons and
 * a waterfall of client requests.
 *
 * Everything here comes from the materialized views in migration 000004 —
 * `revenue_daily`, `bookings_daily`, `doctor_utilization_daily`,
 * `district_activity_daily`. None of it touches a clinical table, and none of
 * it could: the console's database role has no grant on one.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const days = parseRange(params.days);

  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);

  const range = query({
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  });

  const [result, revenueResult, bookingsResult, doctorsResult] = await Promise.all([
    tryGetServer<DashboardSummary>(endpoints.analytics.dashboard(range)),
    tryGetServer<RevenuePoint[]>(endpoints.analytics.revenue(range)),
    tryGetServer<BookingsPoint[]>(endpoints.analytics.bookings(range)),
    tryGetServer<DoctorTotalsRow[]>(endpoints.analytics.doctors(query({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      limit: 10,
    }))),
  ]);

  const header = (
    <PageHeader
      title="Dashboard"
      description={
        <>
          Platform activity for the last {days} days, to {formatDate(to)}. All figures
          are aggregates; no consultation content is available in this console.
        </>
      }
      actions={<RangePickerLinks current={days} options={[...RANGES]} />}
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

  const topSpecialties = summary.top_specialties ?? [];
  const districts = summary.districts ?? [];
  const doctorUtilisation = summary.doctor_utilisation ?? [];
  const revenue = revenueResult.ok ? revenueResult.data : (summary.revenue ?? []);
  const bookingsDaily = bookingsResult.ok ? bookingsResult.data : (summary.bookings_daily ?? []);
  const topDoctors = doctorsResult.ok ? doctorsResult.data : [];

  // Every district, including the ones with no activity — a chart built only
  // from returned rows hides exactly the coverage gaps this view exists to show.
  const districtCounts = new Map(
    districts.map((row) => [districtName(row.district), row.booking_count]),
  );
  const districtItems = DISTRICTS.map((district) => ({
    key: district.code,
    label: district.name,
    note: district.province,
    value: districtCounts.get(district.name) ?? 0,
  }));

  return (
    <>
      {header}

      <section aria-label="Headline figures" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="Gross revenue"
          value={formatMoney(summary.gross_cents, currency)}
          hint={`Commission ${formatMoney(summary.commission_cents, currency)}`}
          icon={Coins}
        />
        <StatTile
          label="Bookings"
          value={formatCount(summary.bookings)}
          hint={`${formatCount(summary.completed_consultations)} completed`}
          icon={CalendarCheck}
        />
        <StatTile label="Active users" value={formatCount(summary.active_users)} icon={UserRound} />
        <StatTile
          label="No-show rate"
          value={formatPercent(summary.no_show_rate)}
          hint="Share of appointments the patient did not attend"
          icon={Percent}
          tone={summary.no_show_rate > 0.15 ? "warning" : "default"}
        />
        <StatTile
          label="Specialties active"
          value={formatCount(topSpecialties.length)}
          hint="Distinct specialties with at least one booking"
          icon={Stethoscope}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardRevenueChart points={revenue} currency={currency} />
        <DashboardBookingsChart points={bookingsDaily} />

        <RankedBars
          title="Top specialties"
          description="Bookings by specialty over the selected range."
          items={topSpecialties.map((row) => ({
            key: row.specialty_code,
            label: humanise(row.specialty_code),
            value: row.booking_count,
          }))}
          emptyLabel="No bookings recorded in this range."
        />

        <RankedBars
          title="Top doctors"
          description="Booking volume from GET /analytics/doctors."
          items={topDoctors.map((row) => ({
            key: row.doctor_id,
            label: row.doctor_id.slice(0, 8),
            value: row.total_count,
          }))}
          emptyLabel="No doctor totals in this range."
        />

        <RankedBars
          title="Bookings by district"
          description="All 25 districts, including those with no activity."
          items={districtItems}
          emptyLabel="No district data recorded in this range."
          maxRows={25}
        />
      </div>

      <section className="mt-6">
        <UtilisationTable rows={doctorUtilisation} />
      </section>
    </>
  );
}

function parseRange(raw: string | undefined): Range {
  const n = Number.parseInt(raw ?? "", 10);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}
