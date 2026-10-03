"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Headset, UserCheck } from "lucide-react";

import { DataTable } from "@/components/admin/data-table/data-table";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/ui/empty-state";
import type { AdminAccount, Dispute, DisputeStatus } from "@/lib/admin/api/types";
import { formatRelative, humanise, shortId } from "@/lib/admin/format";

import { DisputeDrawer } from "./dispute-drawer";

const STATUS_VARIANT: Record<DisputeStatus, "warning" | "info" | "success" | "muted"> = {
  open: "warning",
  investigating: "info",
  resolved: "success",
  closed: "muted",
};

/**
 * Customer-care queue.
 *
 * Sorted by the backend, oldest first, because the metric that matters for a
 * complaint queue is age of the oldest unanswered item — not volume.
 */
export function DisputesBoard({
  disputes,
  admins,
  filtered,
}: {
  disputes: Dispute[];
  admins: AdminAccount[];
  filtered: boolean;
}) {
  const [selected, setSelected] = React.useState<Dispute | null>(null);

  const adminName = React.useCallback(
    (id: string) => {
      const admin = admins.find((a) => a.id === id);
      return admin ? admin.displayName || admin.email : shortId(id);
    },
    [admins],
  );

  const columns = React.useMemo<ColumnDef<Dispute, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Age",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-sm">{formatRelative(row.original.createdAt)}</p>
            <p className="font-mono text-xs text-muted-foreground" title={row.original.id}>
              {shortId(row.original.id)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "subject",
        header: "Complaint",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="max-w-md">
            <p className="text-sm font-medium">{row.original.subject}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">{row.original.description}</p>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Type",
        cell: ({ row }) => <Badge variant="outline">{humanise(row.original.category)}</Badge>,
      },
      {
        accessorKey: "openedBy",
        header: "From",
        cell: ({ row }) => <span className="text-sm">{humanise(row.original.openedBy)}</span>,
      },
      {
        accessorKey: "assignedAdminId",
        header: "Assigned",
        cell: ({ row }) =>
          row.original.assignedAdminId ? (
            <span className="flex items-center gap-1.5 text-sm">
              <UserCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {adminName(row.original.assignedAdminId)}
            </span>
          ) : (
            <Badge variant="warning">Unassigned</Badge>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status]}>{humanise(row.original.status)}</Badge>
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
    [adminName],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={disputes}
        getRowId={(row) => row.id}
        caption="Customer care messages, oldest first. Sorting applies to this page only."
        emptyState={
          <EmptyState
            icon={Headset}
            title={filtered ? "No conversations match these filters" : "No open conversations"}
            description={
              filtered
                ? "Clear the filters to see resolved and closed conversations too."
                : "Patients and doctors send messages from the chat button on their site."
            }
          />
        }
      />

      <DisputeDrawer dispute={selected} admins={admins} onClose={() => setSelected(null)} />
    </>
  );
}
