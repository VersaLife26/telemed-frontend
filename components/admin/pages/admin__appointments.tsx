import type { Metadata } from "next";

import { AppointmentsTable } from "@/components/admin/appointments/appointments-table";
import { DoubleBookingPanel } from "@/components/admin/appointments/double-booking-panel";
import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { FilterBar } from "@/components/admin/data-table/filter-bar";
import { Pagination } from "@/components/admin/data-table/pagination";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryGetServer, tryListServer } from "@/lib/admin/api/server";
import type { AdminAppointment, DoubleBooking } from "@/lib/admin/api/types";
import { DISTRICTS } from "@/lib/admin/districts";
import { filterValues, pageQuery } from "@/lib/admin/url-query";

const metadata: Metadata = { title: "Appointments" };

const PER_PAGE = 25;

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const [listResult, conflictsResult] = await Promise.all([
    tryListServer<AdminAppointment>(
      endpoints.appointments.list(
        query({
          status: params.status,
          district: params.district,
          from: params.from,
          to: params.to,
          q: params.q,
          page,
          per_page: PER_PAGE,
        }),
      ),
    ),
    tryGetServer<DoubleBooking[]>(endpoints.appointments.doubleBookings()),
  ]);

  const filters = [
    {
      name: "q",
      label: "Appointment or doctor",
      kind: "search" as const,
      placeholder: "UUID or doctor name",
    },
    {
      name: "status",
      label: "Status",
      kind: "select" as const,
      options: [
        { value: "created", label: "Created" },
        { value: "confirmed", label: "Confirmed" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
        { value: "no_show", label: "No-show" },
      ],
    },
    {
      name: "district",
      label: "District",
      kind: "select" as const,
      options: DISTRICTS.map((d) => ({ value: d.code, label: d.name })),
    },
    { name: "from", label: "From", kind: "date" as const },
    { name: "to", label: "To", kind: "date" as const },
  ];

  const header = (
    <PageHeader
      title="Appointments"
      description="Every booking, with force-cancel and double-booking resolution. Intake forms, symptoms and consultation notes are not readable from this console."
    />
  );

  const filtered = Boolean(
    params.q || params.status || params.district || params.from || params.to,
  );

  return (
    <>
      {header}

      <section className="mb-6">
        {conflictsResult.ok || conflictsResult.error.code === "NOT_FOUND" ? (
          <DoubleBookingPanel
            conflicts={conflictsResult.ok ? conflictsResult.data : []}
          />
        ) : (
          <ErrorState error={conflictsResult.error} what="double-booking detection" />
        )}
      </section>

      <FilterBar
        filters={filters}
        legend="Filter appointments"
        values={filterValues(params, filters)}
      />

      {listResult.ok ? (
        <>
          <AppointmentsTable appointments={listResult.page.data} filtered={filtered} />
          <Pagination
            meta={listResult.page.meta}
            label="Appointments"
            query={pageQuery(params)}
          />
        </>
      ) : (
        <ErrorState error={routeFatal(listResult.error)} what="the appointment list" />
      )}
    </>
  );
}