import type { Metadata } from "next";

import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { FilterBar } from "@/components/admin/data-table/filter-bar";
import { Pagination } from "@/components/admin/data-table/pagination";
import { UsersTable } from "@/components/admin/users/users-table";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryListServer } from "@/lib/admin/api/server";
import type { AdminUserRecord } from "@/lib/admin/api/types";
import { filterValues, pageQuery } from "@/lib/admin/url-query";

export const metadata: Metadata = { title: "Users" };

const PER_PAGE = 25;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const hasSearch = Boolean(params.q || params.role || params.status);

  const filters = [
    {
      name: "q",
      label: "Name, email or phone",
      kind: "search" as const,
      placeholder: "e.g. Perera, or +94771234567",
    },
    {
      name: "role",
      label: "Role",
      kind: "select" as const,
      options: [
        { value: "patient", label: "Patient" },
        { value: "doctor", label: "Doctor" },
      ],
    },
    {
      name: "status",
      label: "Status",
      kind: "select" as const,
      options: [
        { value: "active", label: "Active" },
        { value: "suspended", label: "Suspended" },
      ],
    },
  ];

  const values = filterValues(params, filters);
  const queryString = pageQuery(params);

  const header = (
    <PageHeader
      title="Users"
      description="Patients and doctors, projected from user-service events. This console can suspend and reinstate an account; it cannot read anything clinical about one."
    />
  );

  // No search, no query. Loading the entire user base because someone opened
  // the page is both slow and the wrong default for a screen that can suspend
  // accounts.
  if (!hasSearch) {
    return (
      <>
        {header}
        <FilterBar filters={filters} legend="Search for users" values={values} />
        <UsersTable users={[]} filtered={false} />
      </>
    );
  }

  const result = await tryListServer<AdminUserRecord>(
    endpoints.users.list(
      query({
        q: params.q,
        role: params.role,
        status: params.status,
        page,
        per_page: PER_PAGE,
      }),
    ),
  );

  if (!result.ok) {
    const error = routeFatal(result.error);
    return (
      <>
        {header}
        <FilterBar filters={filters} legend="Search for users" values={values} />
        <ErrorState error={error} what="the user search" />
      </>
    );
  }

  return (
    <>
      {header}
      <FilterBar filters={filters} legend="Search for users" values={values} />
      <UsersTable users={result.page.data} filtered />
      <Pagination meta={result.page.meta} label="User search" query={queryString} />
    </>
  );
}
