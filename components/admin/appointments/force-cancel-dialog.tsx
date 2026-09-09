"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { AdminAppointment } from "@/lib/admin/api/types";
import { formatDateTime } from "@/lib/admin/format";

const MINIMUM_REASON = 20;

/**
 * Force-cancel.
 *
 * This takes a booking away from a patient who is expecting a doctor, so it is
 * built to be hard to do by accident: the dialog restates the appointment time
 * and the doctor, the reason has a length floor, and the refund decision is an
 * explicit choice rather than a default. Nothing here is inferred.
 */
export function ForceCancelDialog({
  appointment,
  onClose,
}: {
  appointment: AdminAppointment | null;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [refund, setRefund] = React.useState(true);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    setReason("");
    setRefund(true);
    setTouched(false);
  }, [appointment?.appointment_id]);

  const tooShort = reason.trim().length < MINIMUM_REASON;

  const mutation = useApiMutation<unknown, { id: string }>({
    method: "POST",
    path: (variables) => endpoints.appointments.forceCancel(variables.id),
    body: () => ({ reason: reason.trim(), refund }),
    successMessage: () =>
      "Force cancellation requested. scheduling-service releases the slot and publishes appointment.cancelled.",
    onSuccess: onClose,
  });

  return (
    <Dialog
      open={appointment !== null}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Force-cancel this appointment</DialogTitle>
          <DialogDescription>
            {appointment ? (
              <>
                {formatDateTime(appointment.scheduled_at)} with{" "}
                {appointment.doctor_name ?? "the assigned doctor"}. The patient is
                notified immediately.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <Alert variant="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>This cannot be undone from the console</AlertTitle>
          <AlertDescription>
            The slot is released back to the pool and may be re-booked by someone else
            within seconds.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="cancel-reason">
            Reason <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && tooShort}
            aria-describedby="cancel-reason-help"
            placeholder="e.g. Doctor hospitalised; all bookings for 21 Aug moved or cancelled. Ticket OPS-882."
          />
          <p
            id="cancel-reason-help"
            className={
              touched && tooShort ? "text-xs text-destructive" : "text-xs text-muted-foreground"
            }
          >
            {touched && tooShort
              ? `At least ${MINIMUM_REASON} characters.`
              : "Sent to the patient and recorded in the audit log."}
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <Checkbox
            id="cancel-refund"
            checked={refund}
            onCheckedChange={(value) => setRefund(value === true)}
          />
          <div className="space-y-0.5">
            <Label htmlFor="cancel-refund">Refund the payment in full</Label>
            <p className="text-xs text-muted-foreground">
              Publishes <code>admin.refund_approved</code> alongside the cancellation.
              Clear this only when the cancellation is the patient&rsquo;s fault and the
              cancellation policy says no refund is due.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Keep the appointment
          </Button>
          <Button
            variant="destructive"
            disabled={tooShort || mutation.isPending || !appointment}
            onClick={() => {
              setTouched(true);
              if (tooShort || !appointment) return;
              mutation.mutate({ id: appointment.appointment_id });
            }}
          >
            {mutation.isPending ? "Cancelling…" : "Force-cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
