import type { Metadata } from "next";

import { auth } from "@/auth";
import { AuditTable } from "@/components/admin/audit/audit-table";
import { ChainVerifyCard } from "@/components/admin/audit/chain-verify";
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
 * operations. It reads `audit_logs` — append-only at the database level, with a
 * SHA-256 hash chain over every row — and offers three things: a filtered view,
 * a CSV export, and a chain integrity check.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const listQuery = query({
    actor_id: params.actor_id,
    action: params.action,
    resource_type: params.resource_type,
    resource_id: params.resource_id,
    from: toRfc3339(params.from),
    to: toRfc3339(params.to, true),
    page,
    per_page: PER_PAGE,
  });

  const result = await tryListServer<AuditEntry>(endpoints.audit.list(listQuery));

  const filters = [
    { name: "actor_id", label: "Actor (UUID)", kind: "search" as const, placeholder: "admin user id" },
    { name: "action", label: "Action", kind: "search" as const, placeholder: "e.g. doctor.approved" },
    {
      name: "resource_type",
      label: "Resource type",
      kind: "search" as const,
      placeholder: "e.g. doctor",
    },
    { name: "from", label: "From", kind: "date" as const },
    { name: "to", label: "To", kind: "date" as const },
  ];

  const filtered = Boolean(
    params.actor_id || params.action || params.resource_type || params.from || params.to,
  );

  const header = (
    <PageHeader
      title="Audit logs"
      description="Every state-changing action taken through this console. Append-only in the database, hash-chained row to row, and readable but never writable from here."
    />
  );

  return (
    <>
      {header}

      <section className="mb-6">
        <ChainVerifyCard />
      </section>

      <FilterBar
        filters={filters}
        legend="Filter the audit log"
        values={filterValues(params, filters)}
      />

      {result.ok ? (
        <>
          <AuditTable
            entries={result.page.data}
            filtered={filtered}
            exportQuery={listQuery.toString()}
            canExport={can(session?.roles ?? [], "audit_export")}
          />
          <Pagination
            meta={result.page.meta}
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
 * The filter bar sends a date; the backend's `ParseListFilter` wants RFC 3339.
 * `to` is pushed to the end of the day so "to 20 Aug" includes 20 August rather
 * than stopping at midnight, which is the bug every date filter has once.
 */
function toRfc3339(value: string | undefined, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
