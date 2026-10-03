import type { Metadata } from "next";

import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { FilterBar } from "@/components/admin/data-table/filter-bar";
import { Pagination } from "@/components/admin/data-table/pagination";
import { DisputesBoard } from "@/components/admin/disputes/disputes-board";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryGetServer, tryListServer } from "@/lib/admin/api/server";
import type { AdminAccount, Dispute } from "@/lib/admin/api/types";
import { adminRoles } from "@/lib/admin/auth/current";
import { can } from "@/lib/admin/rbac";
import { filterValues, pageQuery } from "@/lib/admin/url-query";

export const metadata: Metadata = { title: "Customer care" };

const PER_PAGE = 25;

export default async function DisputesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const roles = await adminRoles();
  const [disputes, admins] = await Promise.all([
    tryListServer<Dispute>(
      endpoints.disputes.list(
        query({
          status: params.status ?? "open",
          category: params.category,
          page,
          pageSize: PER_PAGE,
        }),
      ),
    ),
    can(roles, "adminUsers")
      ? tryGetServer<AdminAccount[]>(endpoints.adminUsers.list())
      : Promise.resolve(null),
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
      label: "Type",
      kind: "select" as const,
      options: [
        { value: "refund", label: "Refund / payment" },
        { value: "appointment", label: "Appointment" },
        { value: "consultation", label: "Consultation" },
        { value: "prescription", label: "Prescription" },
        { value: "account", label: "Account" },
        { value: "technical", label: "Technical" },
      ],
    },
  ];

  const header = (
    <PageHeader
      title="Customer care"
      description="Messages from patients and doctors. Replies here appear in their chat. A refund recorded with a resolution still has to be approved on Payments."
    />
  );

  const values = filterValues(params, filters);
  const queryString = pageQuery(params);

  if (!disputes.ok) {
    return (
      <>
        {header}
        <FilterBar filters={filters} legend="Filter conversations" values={values} />
        <ErrorState error={routeFatal(disputes.error)} what="the customer care queue" />
      </>
    );
  }

  return (
    <>
      {header}
      <FilterBar filters={filters} legend="Filter conversations" values={values} />
      <DisputesBoard
        disputes={disputes.page.items}
        admins={admins?.ok ? admins.data : []}
        filtered={(params.status ?? "open") !== "open" || Boolean(params.category)}
      />
      <Pagination meta={disputes.page} label="Conversations" query={queryString} />
    </>
  );
}
