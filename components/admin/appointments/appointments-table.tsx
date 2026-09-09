"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarX2, ScrollText, Ban } from "lucide-react";

import { DataTable } from "@/components/admin/data-table/data-table";
import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/ui/empty-state";
import type { AdminAppointment } from "@/lib/admin/api/types";
import { districtName } from "@/lib/admin/districts";
import { formatDateTime, humanise, shortId } from "@/lib/admin/format";

import { AppointmentStatusBadge } from "./status-badge";
import { ForceCancelDialog } from "./force-cancel-dialog";
import { AppointmentAuditDialog } from "./appointment-audit-dialog";

export function AppointmentsTable({
  appointments,
  filtered,
}: {
  appointments: AdminAppointment[];
  filtered: boolean;
}) {
  const [cancelTarget, setCancelTarget] = React.useState<AdminAppointment | null>(null);
  const [auditTarget, setAuditTarget] = React.useState<AdminAppointment | null>(null);

  const columns = React.useMemo<ColumnDef<AdminAppointment, unknown>[]>(
    () => [
      {
        accessorKey: "scheduled_at",
        header: "Scheduled",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-sm">
              {formatDateTime(row.original.scheduled_at)}
            </p>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={row.original.appointment_id}
            >
              {shortId(row.original.appointment_id)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "doctor_name",
        header: "Doctor",
        cell: ({ row }) => row.original.doctor_name ?? shortId(row.original.doctor_id),
      },
      {
        id: "patient",
        header: "Patient",
        enableSorting: false,
        cell: ({ row }) => (
          // Deliberately a reference, not a name: this table exists to resolve
          // scheduling problems, and resolving one never requires knowing which
          // patient it was. The backend sends whatever pseudonymous reference it
          // has; if it sends nothing, nothing is shown.
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.patient_reference ?? shortId(row.original.patient_id)}
          </span>
        ),
      },
      {
        accessorKey: "specialty_code",
        header: "Specialty",
        cell: ({ row }) =>
          row.original.specialty_code ? humanise(row.original.specialty_code) : "—",
      },
      {
        accessorKey: "district",
        header: "District",
        cell: ({ row }) => districtName(row.original.district),
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
            row.original.status === "created" || row.original.status === "confirmed";
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuditTarget(row.original)}
                aria-label={`Audit trail for appointment ${row.original.appointment_id}`}
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
                    : "Only a created or confirmed appointment can be force-cancelled."
                }
                onClick={() => setCancelTarget(row.original)}
              >
                <Ban className="size-4" aria-hidden="true" />
                Force cancel
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
        getRowId={(row) => row.appointment_id}
        caption="Every booking the admin console can see, projected from scheduling-service events. Sorting applies to this page only."
        emptyState={
          <EmptyState
            icon={CalendarX2}
            title={filtered ? "No appointments match these filters" : "No appointments recorded"}
            description={
              filtered
                ? "Widen the date range or clear the status filter."
                : "The appointment projection is empty. It is fed by appointment.* events from scheduling-service."
            }
          />
        }
      />

      <ForceCancelDialog appointment={cancelTarget} onClose={() => setCancelTarget(null)} />
      <AppointmentAuditDialog appointment={auditTarget} onClose={() => setAuditTarget(null)} />
    </>
  );
}
