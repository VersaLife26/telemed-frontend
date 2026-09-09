import type { Metadata } from "next";

import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { FilterBar } from "@/components/admin/data-table/filter-bar";
import { Pagination } from "@/components/admin/data-table/pagination";
import { DisputesBoard } from "@/components/admin/disputes/disputes-board";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryListServer } from "@/lib/admin/api/server";
import type { AdminIdentity, Dispute } from "@/lib/admin/api/types";
import { filterValues, pageQuery } from "@/lib/admin/url-query";

export const metadata: Metadata = { title: "Disputes" };

const PER_PAGE = 25;

export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const [disputes, admins] = await Promise.all([
    tryListServer<Dispute>(
      endpoints.disputes.list(
        query({
          status: params.status ?? "open",
          category: params.category,
          assigned_to: params.assigned_to,
          page,
          per_page: PER_PAGE,
        }),
      ),
    ),
    // Needed to populate the assignment dropdown. Failing to load the admin
    // list must not take the queue down with it, so it is handled separately.
    tryListServer<AdminIdentity>(endpoints.settings.admins(query({ per_page: 100 }))),
  ]);

  const filters = [
    {
      name: "status",
      label: "Status",
      kind: "select" as const,
      options: [
        { value: "open", label: "Open" },
        { value: "investigating", label: "Investigating" },
        { value: "resolved", label: "Resolved" },
        { value: "closed", label: "Closed" },
      ],
    },
    {
      name: "category",
      label: "Category",
      kind: "select" as const,
      options: [
        { value: "billing", label: "Billing" },
        { value: "quality_of_care", label: "Quality of care" },
        { value: "no_show", label: "No-show" },
        { value: "technical", label: "Technical" },
        { value: "other", label: "Other" },
      ],
    },
  ];

  const header = (
    <PageHeader
      title="Disputes"
      description="Patient complaints and refund requests. Resolving a dispute records the outcome; refunds are approved separately on the Payments screen so the money decision is never implicit."
    />
  );

  const values = filterValues(params, filters);
  const queryString = pageQuery(params);

  if (!disputes.ok) {
    return (
      <>
        {header}
        <FilterBar filters={filters} legend="Filter disputes" values={values} />
        <ErrorState error={routeFatal(disputes.error)} what="the dispute queue" />
      </>
    );
  }

  return (
    <>
      {header}
      <FilterBar filters={filters} legend="Filter disputes" values={values} />
      <DisputesBoard
        disputes={disputes.page.data}
        admins={admins.ok ? admins.page.data : []}
        filtered={Boolean(params.category || params.assigned_to) || (params.status ?? "open") !== "open"}
      />
      <Pagination meta={disputes.page.meta} label="Disputes" query={queryString} />
    </>
  );
}
