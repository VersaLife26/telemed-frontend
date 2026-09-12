"use client";

import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { AdminRescheduleRequest } from "@/lib/admin/api/types";
import { formatDateTime, shortId } from "@/lib/admin/format";

export function RescheduleQueue({ requests }: { requests: AdminRescheduleRequest[] }) {
  if (requests.length === 0) {
    return (
      <EmptyState
        title="No pending reschedule requests"
        description="When a doctor cannot attend a booked visit they propose a new time here. Accept only after the patient agrees, or decline for a full refund."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {requests.map((req) => (
        <RescheduleRow key={req.id} request={req} />
      ))}
    </ul>
  );
}

function RescheduleRow({ request }: { request: AdminRescheduleRequest }) {
  const accept = useApiMutation<unknown, void>({
    method: "POST",
    path: () => endpoints.appointments.acceptReschedule(request.id),
    successMessage: () => "Visit moved to the proposed time. Payment is unchanged.",
  });
  const decline = useApiMutation<unknown, void>({
    method: "POST",
    path: () => endpoints.appointments.declineReschedule(request.id),
    successMessage: () => "Request declined. The original visit was cancelled with a full refund.",
  });
  const busy = accept.isPending || decline.isPending;

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">
            {formatDateTime(request.original_start_at)} →{" "}
            {formatDateTime(request.proposed_start_at)}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            Appointment {shortId(request.appointment_id)} · patient {shortId(request.patient_id)} ·
            doctor {shortId(request.doctor_id)}
          </p>
          {request.reason ? (
            <p className="text-sm text-muted-foreground">Doctor’s reason: {request.reason}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No reason given.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => accept.mutate()}>
            Accept (patient agreed)
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => decline.mutate()}
          >
            Decline (full refund)
          </Button>
        </div>
      </div>
    </li>
  );
}
