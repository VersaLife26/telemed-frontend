"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Button } from "@/components/admin/ui/button";
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
import type { Appointment } from "@/lib/admin/api/types";
import { formatDateTime } from "@/lib/admin/format";

const MINIMUM_REASON = 20;

/**
 * Admin cancellation.
 *
 * This takes a booking away from a patient who is expecting a doctor, so it is
 * built to be hard to do by accident: the dialog restates the appointment time
 * and the reason has a length floor. The refund follows the cancellation
 * policy; any other amount is a separate refund from the Payments screen.
 */
export function CancelDialog({
  appointment,
  onClose,
}: {
  appointment: Appointment | null;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    setReason("");
    setTouched(false);
  }, [appointment?.id]);

  const tooShort = reason.trim().length < MINIMUM_REASON;

  const mutation = useApiMutation<unknown, { id: string }>({
    method: "POST",
    path: (variables) => endpoints.appointments.cancel(variables.id),
    body: () => ({ reason: reason.trim() }),
    successMessage: () => "Appointment cancelled. Any refund due under the policy has been started.",
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
          <DialogTitle>Cancel this appointment</DialogTitle>
          <DialogDescription>
            {appointment ? (
              <>
                {formatDateTime(appointment.startAt)} for {appointment.visitPatient.name}.
                The patient is notified immediately.
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

        <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
          Any payment is refunded according to the cancellation policy. To refund a
          different amount, create a manual refund from the Payments screen afterwards.
        </p>

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
              mutation.mutate({ id: appointment.id });
            }}
          >
            {mutation.isPending ? "Cancelling…" : "Cancel appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
