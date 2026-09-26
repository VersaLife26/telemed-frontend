import Link from "next/link";

import { AppointmentsTable } from "@/components/admin/appointments/appointments-table";
import { RescheduleQueue } from "@/components/admin/appointments/reschedule-queue";
import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { FilterBar } from "@/components/admin/data-table/filter-bar";
import { Pagination } from "@/components/admin/data-table/pagination";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryListServer } from "@/lib/admin/api/server";
import type { Appointment, RescheduleRequest } from "@/lib/admin/api/types";
import { filterValues, pageQuery } from "@/lib/admin/url-query";
import { cn } from "@/lib/admin/utils";

const PER_PAGE = 25;

/** The filter bar's dates are Colombo calendar days; the API takes instants. */
const COLOMBO_OFFSET = "+05:30";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const tab = params.tab === "reschedule" ? "reschedule" : "all";

  const header = (
    <PageHeader
      title="Appointments"
      description="Every booking, with admin cancellation and doctor-requested reschedules. Consultation notes are not readable from this console."
    />
  );

  const tabs = (
    <nav className="mb-6 flex gap-1 rounded-lg bg-muted p-1 text-muted-foreground" aria-label="Appointment views">
      <Link
        href="/appointments"
        className={cn(
          "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium",
          tab === "all" && "bg-background text-foreground shadow-sm",
        )}
      >
        All bookings
      </Link>
      <Link
        href="/appointments?tab=reschedule"
        className={cn(
          "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium",
          tab === "reschedule" && "bg-background text-foreground shadow-sm",
        )}
      >
        Reschedule requests
      </Link>
    </nav>
  );

  if (tab === "reschedule") {
    const listResult = await tryListServer<RescheduleRequest>(
      endpoints.appointments.rescheduleRequests(
        query({ status: "pending", page, pageSize: PER_PAGE }),
      ),
    );

    return (
      <>
        {header}
        {tabs}
        {listResult.ok ? (
          <>
            <RescheduleQueue requests={listResult.page.items} />
            <Pagination
              meta={listResult.page}
              label="Reschedule requests"
              query="tab=reschedule"
            />
          </>
        ) : (
          <ErrorState error={routeFatal(listResult.error)} what="pending reschedule requests" />
        )}
      </>
    );
  }

  const listResult = await tryListServer<Appointment>(
    endpoints.appointments.list(
      query({
        status: params.status,
        doctorId: params.doctorId,
        patientId: params.patientId,
        from: params.from ? `${params.from}T00:00:00${COLOMBO_OFFSET}` : undefined,
        to: params.to ? `${params.to}T23:59:59.999${COLOMBO_OFFSET}` : undefined,
        page,
        pageSize: PER_PAGE,
      }),
    ),
  );

  const filters = [
    {
      name: "doctorId",
      label: "Doctor ID",
      kind: "search" as const,
      placeholder: "Doctor UUID",
    },
    {
      name: "patientId",
      label: "Patient ID",
      kind: "search" as const,
      placeholder: "Patient UUID",
    },
    {
      name: "status",
      label: "Status",
      kind: "select" as const,
      options: [
        { value: "pendingPayment", label: "Pending payment" },
        { value: "confirmed", label: "Confirmed" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
        { value: "noShow", label: "No-show" },
      ],
    },
    { name: "from", label: "From", kind: "date" as const },
    { name: "to", label: "To", kind: "date" as const },
  ];

  const filtered = Boolean(
    params.doctorId || params.patientId || params.status || params.from || params.to,
  );

  return (
    <>
      {header}
      {tabs}

      <FilterBar
        filters={filters}
        legend="Filter appointments"
        values={filterValues(params, filters)}
      />

      {listResult.ok ? (
        <>
          <AppointmentsTable appointments={listResult.page.items} filtered={filtered} />
          <Pagination
            meta={listResult.page}
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
