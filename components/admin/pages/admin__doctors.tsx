import type { Metadata } from "next";

import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { NewApplicationsAlert } from "@/components/admin/credentialing/new-applications-alert";
import { PendingDoctorsTable } from "@/components/admin/credentialing/pending-table";
import { FilterBar } from "@/components/admin/data-table/filter-bar";
import { Pagination } from "@/components/admin/data-table/pagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryListServer } from "@/lib/admin/api/server";
import type { DoctorApplicationStatus, DoctorApplicationSummary } from "@/lib/admin/api/types";
import { checkSlmcFormat } from "@/lib/admin/credentialing";
import { filterValues, pageQuery } from "@/lib/admin/url-query";
import { ShieldQuestion } from "lucide-react";

const metadata: Metadata = { title: "Verification queue" };

const PAGE_SIZE = 25;

const STATUSES: readonly string[] = ["pending", "underReview", "approved", "rejected"];

function isStatus(value: string | undefined): value is DoctorApplicationStatus {
  return value !== undefined && STATUSES.includes(value);
}

/**
 * The doctor verification queue.
 *
 * Rendered on the server: this is a table of up to twenty-five rows with
 * URL-driven filters and no per-row interactivity beyond navigation, which is
 * exactly the case where a server component earns its keep — the browser gets
 * a populated table on first paint instead of a skeleton plus a fetch.
 */
export default async function VerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const status: DoctorApplicationStatus = isStatus(params.status) ? params.status : "pending";

  const result = await tryListServer<DoctorApplicationSummary>(
    endpoints.credentialing.list(query({ status, page, pageSize: PAGE_SIZE })),
  );

  const filters = [
    {
      name: "status",
      label: "Status",
      kind: "select" as const,
      options: [
        { value: "pending", label: "Pending" },
        { value: "underReview", label: "Under review" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
      ],
    },
  ];

  const values = filterValues(params, filters);
  const queryString = pageQuery(params);

  const header = (
    <PageHeader
      title="Doctor verification queue"
      description="Every doctor application and where it stands. Nothing here reaches a patient until it is approved."
    />
  );

  if (!result.ok) {
    const error = routeFatal(result.error);
    return (
      <>
        {header}
        <FilterBar filters={filters} legend="Filter the verification queue" values={values} />
        <ErrorState error={error} what="the verification queue" />
      </>
    );
  }

  const doctors = result.page.items;
  const malformed = doctors.filter((d) => !checkSlmcFormat(d.slmcNumber).valid).length;
  const isFiltered = status !== "pending";

  return (
    <>
      {header}

      <NewApplicationsAlert />

      <FilterBar filters={filters} legend="Filter the verification queue" values={values} />

      {malformed > 0 ? (
        <Alert variant="warning" className="mb-4">
          <ShieldQuestion aria-hidden="true" />
          <AlertTitle>
            {malformed} registration{malformed === 1 ? "" : "s"} on this page have a
            malformed SLMC number
          </AlertTitle>
          <AlertDescription>
            A number that is not even the right shape cannot be on the register. These
            can usually be rejected without opening the documents.
          </AlertDescription>
        </Alert>
      ) : null}

      <PendingDoctorsTable doctors={doctors} filtered={isFiltered} />
      <Pagination meta={result.page} label="Verification queue" query={queryString} />
    </>
  );
}
