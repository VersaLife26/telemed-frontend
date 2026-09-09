"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MessageSquareWarning, UserCheck } from "lucide-react";

import { DataTable } from "@/components/admin/data-table/data-table";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/ui/empty-state";
import type { AdminIdentity, Dispute, DisputeStatus } from "@/lib/admin/api/types";
import { formatMoney, formatRelative, humanise, shortId } from "@/lib/admin/format";

import { DisputeDrawer } from "./dispute-drawer";

const STATUS_VARIANT: Record<
  DisputeStatus,
  "warning" | "info" | "success" | "muted"
> = {
  open: "warning",
  investigating: "info",
  resolved: "success",
  closed: "muted",
};

/**
 * The dispute queue.
 *
 * Sorted by the backend, oldest first, because the metric that matters for a
 * complaint queue is age of the oldest unanswered item — not volume. A queue
 * sorted newest-first quietly buries the one that has been open eleven days.
 */
export function DisputesBoard({
  disputes,
  admins,
  filtered,
}: {
  disputes: Dispute[];
  admins: AdminIdentity[];
  filtered: boolean;
}) {
  const [selected, setSelected] = React.useState<Dispute | null>(null);

  const columns = React.useMemo<ColumnDef<Dispute, unknown>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "Age",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-sm">
              {formatRelative(row.original.created_at)}
            </p>
            <p className="font-mono text-xs text-muted-foreground" title={row.original.id}>
              {shortId(row.original.id)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => <Badge variant="outline">{humanise(row.original.category)}</Badge>,
      },
      {
        accessorKey: "description",
        header: "Complaint",
        enableSorting: false,
        cell: ({ row }) => (
          <p className="line-clamp-2 max-w-md text-sm">{row.original.description}</p>
        ),
      },
      {
        accessorKey: "doctor_name",
        header: "Doctor",
        cell: ({ row }) => row.original.doctor_name ?? shortId(row.original.doctor_id),
      },
      {
        id: "refund",
        header: "Refund",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.refund_requested ? (
            <span className="tabular-nums">
              {formatMoney(row.original.refund_amount_cents, row.original.currency)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "assigned_to_name",
        header: "Assigned",
        cell: ({ row }) =>
          row.original.assigned_to_name ? (
            <span className="flex items-center gap-1.5 text-sm">
              <UserCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {row.original.assigned_to_name}
            </span>
          ) : (
            <Badge variant="warning">Unassigned</Badge>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status]}>
            {humanise(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setSelected(row.original)}>
              Open
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={disputes}
        getRowId={(row) => row.id}
        caption="Patient complaints and refund requests, oldest first. Sorting applies to this page only."
        emptyState={
          <EmptyState
            icon={MessageSquareWarning}
            title={filtered ? "No disputes match these filters" : "No open disputes"}
            description={
              filtered
                ? "Clear the status filter to see resolved and closed disputes too."
                : "Nothing is waiting on mediation. Disputes are raised by patients through the support flow in the patient app."
            }
          />
        }
      />

      <DisputeDrawer
        dispute={selected}
        admins={admins}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
