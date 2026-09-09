"use client";

import { ScrollText } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiList } from "@/lib/admin/api/hooks";
import type { AdminAppointment, AuditEntry } from "@/lib/admin/api/types";
import { formatDateTime, humanise, shortId } from "@/lib/admin/format";

/**
 * The audit trail for one appointment, taken from the same append-only,
 * hash-chained `audit_logs` table the audit page reads. Shown here because
 * "who cancelled this and when" is a question asked while looking at the
 * appointment, not while looking at a log viewer.
 */
export function AppointmentAuditDialog({
  appointment,
  onClose,
}: {
  appointment: AdminAppointment | null;
  onClose: () => void;
}) {
  const enabled = appointment !== null;
  const queryResult = useApiList<AuditEntry>(
    ["appointment-audit", appointment?.appointment_id ?? ""],
    appointment ? endpoints.appointments.audit(appointment.appointment_id) : "",
    { enabled },
  );

  return (
    <Dialog open={enabled} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Audit trail</DialogTitle>
          <DialogDescription>
            Appointment{" "}
            <span className="font-mono">{appointment?.appointment_id ?? ""}</span>. Every
            admin action against this booking, oldest first.
          </DialogDescription>
        </DialogHeader>

        {queryResult.isPending ? (
          <div className="space-y-2" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading audit trail</span>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : queryResult.isError ? (
          <Alert variant="destructive">
            <ScrollText aria-hidden="true" />
            <AlertTitle>Could not load the audit trail</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>{queryResult.error.userMessage}</p>
              {queryResult.error.requestId ? (
                <p className="font-mono text-xs">Request ID: {queryResult.error.requestId}</p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : queryResult.data.data.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No admin actions recorded"
            description="Nothing has been done to this appointment through the console. Patient- and doctor-initiated changes are logged by their own services, not here."
          />
        ) : (
          <ol className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {queryResult.data.data.map((entry) => (
              <li key={entry.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{humanise(entry.action)}</p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(entry.created_at)}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {entry.actor_role}
                  {entry.actor_id ? ` · ${shortId(entry.actor_id)}` : ""}
                  {entry.ip ? ` · ${entry.ip}` : ""}
                </p>
                {entry.request_id ? (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    Request ID: {entry.request_id}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
