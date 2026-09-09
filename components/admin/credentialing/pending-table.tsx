"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { BadgeCheck, TriangleAlert } from "lucide-react";

import { DataTable } from "@/components/admin/data-table/data-table";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Badge } from "@/components/admin/ui/badge";
import type { PendingDoctor } from "@/lib/admin/api/types";
import { checkSlmcFormat, meetsExperienceBar } from "@/lib/admin/credentialing";
import { formatRelative, humanise } from "@/lib/admin/format";

import { VerificationStatusBadge } from "./status-badge";

/**
 * The queue.
 *
 * Two signals are computed in the list rather than left for the detail view:
 * whether the SLMC number is even well-formed, and whether the stated
 * experience clears the five-year bar. Both are cheap, and surfacing them here
 * lets a reviewer triage a morning's queue — the malformed ones can be
 * rejected without opening four documents.
 *
 * Navigation uses a real Link on the doctor name so a click works even when
 * row onClick hydration fails (and so middle-click / open-in-new-tab work).
 */
export function PendingDoctorsTable({
  doctors,
  filtered,
}: {
  doctors: PendingDoctor[];
  /** True when a filter is active, so the empty state can say which case it is. */
  filtered: boolean;
}) {
  const columns = React.useMemo<ColumnDef<PendingDoctor, unknown>[]>(
    () => [
      {
        accessorKey: "full_name",
        header: "Doctor",
        cell: ({ row }) => {
          const id = row.original.doctor_id;
          const body = (
            <>
              <p className="truncate font-medium">{row.original.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.original.email ?? row.original.phone ?? "No contact on file"}
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
        accessorKey: "slmc_number",
        header: "SLMC number",
        cell: ({ row }) => {
          const check = checkSlmcFormat(row.original.slmc_number);
          return (
            <span className="flex items-center gap-1.5 font-mono text-sm">
              {row.original.slmc_number}
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
        accessorKey: "specialty_code",
        header: "Specialty",
        cell: ({ row }) =>
          row.original.specialty_code ? humanise(row.original.specialty_code) : "—",
      },
      {
        accessorKey: "years_experience",
        header: "Experience",
        cell: ({ row }) => {
          const years = row.original.years_experience;
          if (years === null) return <span className="text-muted-foreground">Not stated</span>;
          return (
            <span className="flex items-center gap-1.5 tabular-nums">
              {years} yr{years === 1 ? "" : "s"}
              {meetsExperienceBar(years) ? null : (
                <Badge variant="warning" title="Below the five-year minimum">
                  Under 5
                </Badge>
              )}
            </span>
          );
        },
      },
      {
        accessorKey: "registered_at",
        header: "Waiting",
        cell: ({ row }) => (
          <span title={row.original.registered_at} suppressHydrationWarning>
            {formatRelative(row.original.registered_at)}
          </span>
        ),
      },
      {
        accessorKey: "verification_status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <VerificationStatusBadge status={row.original.verification_status} />,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={doctors}
      getRowId={(row) => row.doctor_id}
      caption="Doctors awaiting credential review. Open a doctor name to view documents and the checklist. Sorting applies to the doctors on this page only."
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
            description="Every registered doctor has been reviewed. New registrations appear here as doctor-service publishes doctor.registered."
          />
        )
      }
    />
  );
}
