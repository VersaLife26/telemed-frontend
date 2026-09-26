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
import { useApiQuery } from "@/lib/admin/api/hooks";
import type { Appointment, AuditEntry } from "@/lib/admin/api/types";
import { formatDateTime, humanise, shortId } from "@/lib/admin/format";

/**
 * The audit trail for one appointment, taken from the same audit log the audit
 * page reads. Shown here because
 * "who cancelled this and when" is a question asked while looking at the
 * appointment, not while looking at a log viewer.
 */
export function AppointmentAuditDialog({
  appointment,
  onClose,
}: {
  appointment: Appointment | null;
  onClose: () => void;
}) {
  const enabled = appointment !== null;
  const queryResult = useApiQuery<AuditEntry[]>(
    ["appointment-audit", appointment?.id ?? ""],
    appointment ? endpoints.appointments.audit(appointment.id) : "",
    { enabled },
  );

  return (
    <Dialog open={enabled} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Audit trail</DialogTitle>
          <DialogDescription>
            Appointment{" "}
            <span className="font-mono">{appointment?.id ?? ""}</span>. Every
            recorded action against this booking.
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
              {queryResult.error.traceId ? (
                <p className="font-mono text-xs">Trace ID: {queryResult.error.traceId}</p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : queryResult.data.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No actions recorded"
            description="Nothing has been logged against this appointment."
          />
        ) : (
          <ol className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {queryResult.data.map((entry) => (
              <li key={entry.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{humanise(entry.action)}</p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {humanise(entry.actorType)}
                  {entry.actorEmail
                    ? ` · ${entry.actorEmail}`
                    : entry.actorId
                      ? ` · ${shortId(entry.actorId)}`
                      : ""}
                  {entry.ip ? ` · ${entry.ip}` : ""}
                </p>
                {entry.requestId ? (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    Request ID: {entry.requestId}
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
