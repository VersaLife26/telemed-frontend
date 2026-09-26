"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { BadgeCheck, TriangleAlert } from "lucide-react";

import { DataTable } from "@/components/admin/data-table/data-table";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Badge } from "@/components/admin/ui/badge";
import type { DoctorApplicationSummary } from "@/lib/admin/api/types";
import { checkSlmcFormat } from "@/lib/admin/credentialing";
import { formatRelative, humanise } from "@/lib/admin/format";

import { VerificationStatusBadge } from "./status-badge";

/**
 * The queue.
 *
 * Whether the SLMC number is even well-formed is computed in the list rather
 * than left for the detail view. It is cheap, and surfacing it here lets a
 * reviewer triage a morning's queue — the malformed ones can be rejected
 * without opening four documents.
 *
 * Navigation uses a real Link on the doctor name so a click works even when
 * row onClick hydration fails (and so middle-click / open-in-new-tab work).
 */
export function PendingDoctorsTable({
  doctors,
  filtered,
}: {
  doctors: DoctorApplicationSummary[];
  /** True when a filter is active, so the empty state can say which case it is. */
  filtered: boolean;
}) {
  const columns = React.useMemo<ColumnDef<DoctorApplicationSummary, unknown>[]>(
    () => [
      {
        accessorKey: "displayName",
        header: "Doctor",
        cell: ({ row }) => {
          const id = row.original.id;
          const body = (
            <>
              <p className="truncate font-medium">{row.original.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.original.email || row.original.phone || "No contact on file"}
              </p>
            </>
          );
          if (!id) return <div className="min-w-0">{body}</div>;
          return (
            <Link
              href={`/doctors/${id}`}
              className="block min-w-0 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {body}
            </Link>
          );
        },
      },
      {
        accessorKey: "slmcNumber",
        header: "SLMC number",
        cell: ({ row }) => {
          const check = checkSlmcFormat(row.original.slmcNumber);
          return (
            <span className="flex items-center gap-1.5 font-mono text-sm">
              {row.original.slmcNumber}
              {check.valid ? null : (
                <Badge variant="destructive" title={check.reason}>
                  <TriangleAlert className="size-3" aria-hidden="true" />
                  Bad format
                </Badge>
              )}
            </span>
          );
        },
      },
      {
        accessorKey: "specialtyCode",
        header: "Specialty",
        cell: ({ row }) => humanise(row.original.specialtyCode),
      },
      {
        accessorKey: "createdAt",
        header: "Waiting",
        cell: ({ row }) => (
          <span title={row.original.createdAt} suppressHydrationWarning>
            {formatRelative(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <VerificationStatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={doctors}
      getRowId={(row) => row.id}
      caption="Doctor applications. Open a doctor name to view documents and the checklist. Sorting applies to the doctors on this page only."
      emptyState={
        filtered ? (
          <EmptyState
            icon={BadgeCheck}
            title="No doctors match these filters"
            description="Clear the filters to see the whole queue."
          />
        ) : (
          <EmptyState
            icon={BadgeCheck}
            title="The verification queue is empty"
            description="Every registered doctor has been reviewed. New applications appear here as doctors apply."
          />
        )
      }
    />
  );
}
