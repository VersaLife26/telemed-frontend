"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarX2, ScrollText, Ban } from "lucide-react";

import { DataTable } from "@/components/admin/data-table/data-table";
import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/ui/empty-state";
import type { Appointment } from "@/lib/admin/api/types";
import { formatDateTime, shortId } from "@/lib/admin/format";

import { AppointmentStatusBadge } from "./status-badge";
import { CancelDialog } from "./cancel-dialog";
import { AppointmentAuditDialog } from "./appointment-audit-dialog";
import { AppointmentDetailDialog } from "./appointment-detail-dialog";

export function AppointmentsTable({
  appointments,
  filtered,
}: {
  appointments: Appointment[];
  filtered: boolean;
}) {
  const [cancelTarget, setCancelTarget] = React.useState<Appointment | null>(null);
  const [auditTarget, setAuditTarget] = React.useState<Appointment | null>(null);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const columns = React.useMemo<ColumnDef<Appointment, unknown>[]>(
    () => [
      {
        accessorKey: "startAt",
        header: "Scheduled",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-sm">
              {formatDateTime(row.original.startAt)}
            </p>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={row.original.id}
            >
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => setDetailId(row.original.id)}
              >
                {shortId(row.original.id)}
              </button>

            </p>
          </div>
        ),
      },
      {
        accessorKey: "doctorId",
        header: "Doctor",
        cell: ({ row }) => (
          <span className="font-mono text-xs" title={row.original.doctorId}>
            {shortId(row.original.doctorId)}
          </span>
        ),
      },
      {
        id: "patient",
        header: "Patient",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.visitPatient.name}</p>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={row.original.patientId}
            >
              {shortId(row.original.patientId)}
            </p>
          </div>
        ),
      },

      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <AppointmentStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const cancellable =
            row.original.status === "pendingPayment" || row.original.status === "confirmed";
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuditTarget(row.original)}
                aria-label={`Audit trail for appointment ${row.original.id}`}
              >
                <ScrollText className="size-4" aria-hidden="true" />
                Trail
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!cancellable}
                title={
                  cancellable
                    ? undefined
                    : "Only an unpaid or confirmed appointment can be cancelled."
                }
                onClick={() => setCancelTarget(row.original)}
              >
                <Ban className="size-4" aria-hidden="true" />
                Cancel
              </Button>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={appointments}
        getRowId={(row) => row.id}
        caption="Every booking on the platform. Sorting applies to this page only."
        emptyState={
          <EmptyState
            icon={CalendarX2}
            title={filtered ? "No appointments match these filters" : "No appointments recorded"}
            description={
              filtered
                ? "Widen the date range or clear the status filter."
                : "Bookings appear here as soon as a patient makes one."
            }
          />
        }
      />

      <CancelDialog appointment={cancelTarget} onClose={() => setCancelTarget(null)} />
      <AppointmentAuditDialog appointment={auditTarget} onClose={() => setAuditTarget(null)} />
      <AppointmentDetailDialog appointmentId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
