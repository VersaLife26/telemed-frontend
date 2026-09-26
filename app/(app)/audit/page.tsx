import type { Metadata } from "next";

import { adminRoles } from "@/lib/admin/auth/current";
import { AuditTable } from "@/components/admin/audit/audit-table";
import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { FilterBar } from "@/components/admin/data-table/filter-bar";
import { Pagination } from "@/components/admin/data-table/pagination";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryListServer } from "@/lib/admin/api/server";
import type { AuditEntry } from "@/lib/admin/api/types";
import { can } from "@/lib/admin/rbac";
import { filterValues, pageQuery } from "@/lib/admin/url-query";

export const metadata: Metadata = { title: "Audit logs" };

const PER_PAGE = 50;

/**
 * The audit log.
 *
 * This is the one screen in the console that is evidence rather than
 * operations. It offers two things: a filtered view and a CSV export.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [roles, params] = await Promise.all([adminRoles(), searchParams]);
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const listQuery = query({
    actorId: params.actorId,
    entityType: params.entityType,
    entityId: params.entityId,
    from: toRfc3339(params.from),
    to: toRfc3339(params.to, true),
  });

  const result = await tryListServer<AuditEntry>(
    endpoints.audit.list(query({ ...Object.fromEntries(listQuery), page, pageSize: PER_PAGE })),
  );

  const filters = [
    { name: "actorId", label: "Actor (UUID)", kind: "search" as const, placeholder: "admin or user id" },
    {
      name: "entityType",
      label: "Entity type",
      kind: "search" as const,
      placeholder: "e.g. doctor",
    },
    { name: "entityId", label: "Entity id", kind: "search" as const },
    { name: "from", label: "From", kind: "date" as const },
    { name: "to", label: "To", kind: "date" as const },
  ];

  const filtered = Boolean(
    params.actorId || params.entityType || params.entityId || params.from || params.to,
  );

  const header = (
    <PageHeader
      title="Audit logs"
      description="Every state-changing action on the platform. Readable but never writable from here."
    />
  );

  return (
    <>
      {header}

      <FilterBar
        filters={filters}
        legend="Filter the audit log"
        values={filterValues(params, filters)}
      />

      {result.ok ? (
        <>
          <AuditTable
            entries={result.page.items}
            filtered={filtered}
            exportQuery={listQuery.toString()}
            canExport={can(roles, "auditExport")}
          />
          <Pagination
            meta={result.page}
            label="Audit log"
            query={pageQuery(params)}
          />
        </>
      ) : (
        <ErrorState error={routeFatal(result.error)} what="the audit log" />
      )}
    </>
  );
}

/**
 * The filter bar sends a date; the API wants an ISO date-time.
 * `to` is pushed to the end of the day so "to 20 Aug" includes 20 August rather
 * than stopping at midnight, which is the bug every date filter has once.
 */
function toRfc3339(value: string | undefined, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
