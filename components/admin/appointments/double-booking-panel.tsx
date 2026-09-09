"use client";

import * as React from "react";
import { CalendarClock, CircleAlert } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { DoubleBooking } from "@/lib/admin/api/types";
import { formatDateTime, shortId } from "@/lib/admin/format";
import { cn } from "@/lib/admin/utils";

const MINIMUM_REASON = 20;

/**
 * Double-booking resolution.
 *
 * Scheduling-service is built so this should be empty: a Redis lock, a
 * `SELECT ... FOR UPDATE`, a version-guarded update and a `UNIQUE(slot_id)`
 * constraint, with a 100-goroutine concurrency test asserting exactly one
 * winner. If a row appears here, one of those failed — most plausibly a manual
 * database intervention or a restore from a backup taken mid-transaction.
 *
 * So this panel says so. An operator who finds a double booking should treat it
 * as an incident, not as routine queue work, and the screen that shows it is
 * the right place to say that once.
 */
export function DoubleBookingPanel({ conflicts }: { conflicts: DoubleBooking[] }) {
  if (conflicts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Double bookings</CardTitle>
          <CardDescription>
            Two appointments holding the same slot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={CalendarClock}
            title="No double bookings"
            description="Expected. The booking path holds a distributed lock, a row lock and a unique constraint on slot_id; a conflict reaching this screen means one of those was bypassed."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Double bookings</CardTitle>
        <CardDescription>
          {conflicts.length} slot{conflicts.length === 1 ? "" : "s"} held by more than one
          appointment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Treat this as an incident, not as queue work</AlertTitle>
          <AlertDescription>
            The booking path enforces one appointment per slot with a Redis lock, a
            row-level lock, an optimistic version check and a UNIQUE constraint. A
            conflict here means one of those was bypassed — raise it with whoever owns
            scheduling-service before resolving it.
          </AlertDescription>
        </Alert>

        <ul className="space-y-4">
          {conflicts.map((conflict) => (
            <ConflictRow key={conflict.slot_id} conflict={conflict} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ConflictRow({ conflict }: { conflict: DoubleBooking }) {
  const [keep, setKeep] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const tooShort = reason.trim().length < MINIMUM_REASON;
  const groupId = React.useId();

  const mutation = useApiMutation<unknown, void>({
    method: "POST",
    path: () => endpoints.appointments.resolveDoubleBooking(),
    body: () => {
      const cancel = conflict.appointments.find(
        (appointment) => appointment.appointment_id !== keep,
      )?.appointment_id;
      return {
        keep_appointment_id: keep,
        cancel_appointment_id: cancel,
        reason: reason.trim(),
      };
    },
    successMessage: () =>
      "Resolution requested. Every other appointment on this slot is being cancelled.",
  });

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="mb-3">
        <p className="text-sm font-medium">
          {formatDateTime(conflict.scheduled_at)} · {conflict.doctor_name ?? "Unknown doctor"}
        </p>
        <p className="font-mono text-xs text-muted-foreground" title={conflict.slot_id}>
          Slot {shortId(conflict.slot_id)}
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">
          Which appointment keeps the slot?
        </legend>
        {conflict.appointments.map((appointment) => {
          const inputId = `${groupId}-${appointment.appointment_id}`;
          return (
            <div
              key={appointment.appointment_id}
              className={cn(
                "flex items-start gap-3 rounded-md border p-3",
                keep === appointment.appointment_id
                  ? "border-primary bg-accent/50"
                  : "border-border",
              )}
            >
              <input
                id={inputId}
                type="radio"
                name={groupId}
                value={appointment.appointment_id}
                checked={keep === appointment.appointment_id}
                onChange={() => setKeep(appointment.appointment_id)}
                className="mt-1 size-4 accent-[var(--primary)]"
              />
              {/* Explicit htmlFor rather than a wrapping <label>: the control's
                  accessible name is the appointment id, and the two detail
                  lines below are described text, not part of the name. */}
              <label htmlFor={inputId} className="min-w-0 cursor-pointer text-sm">
                <span className="block font-mono text-xs">
                  {appointment.appointment_id}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Status {appointment.status} · booked{" "}
                  {formatDateTime(appointment.occurred_at)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Patient reference{" "}
                  {appointment.patient_reference ?? shortId(appointment.patient_id)}
                </span>
              </label>
            </div>
          );
        })}
      </fieldset>

      <div className="mt-3 space-y-2">
        <Label htmlFor={`${groupId}-reason`}>
          Reason <span aria-hidden="true">*</span>
          <span className="sr-only">(required)</span>
        </Label>
        <Textarea
          id={`${groupId}-reason`}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && tooShort}
          placeholder="e.g. Earlier booking kept; the later one was created during the 03:14 restore. Patient contacted and re-booked for 22 Aug."
        />
        {touched && tooShort ? (
          <p className="text-xs text-destructive">
            At least {MINIMUM_REASON} characters.
          </p>
        ) : null}
      </div>

      <Button
        className="mt-3"
        variant="destructive"
        disabled={keep === null || tooShort || mutation.isPending}
        onClick={() => {
          setTouched(true);
          if (keep === null || tooShort) return;
          mutation.mutate();
        }}
      >
        {mutation.isPending ? "Resolving…" : "Cancel the others and keep this one"}
      </Button>
    </li>
  );
}
