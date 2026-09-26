"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiQuery } from "@/lib/admin/api/hooks";
import type { AdminAppointmentDetail } from "@/lib/admin/api/types";
import { formatDateTime, formatMoney, humanise, shortId } from "@/lib/admin/format";

export function AppointmentDetailDialog({
  appointmentId,
  onClose,
}: {
  appointmentId: string | null;
  onClose: () => void;
}) {
  const enabled = appointmentId !== null;
  const detail = useApiQuery<AdminAppointmentDetail>(
    ["appointment-detail", appointmentId ?? ""],
    appointmentId ? endpoints.appointments.detail(appointmentId) : "",
    { enabled },
  );

  const appointment = detail.data?.appointment;
  const payment = detail.data?.payment;
  const reschedules = detail.data?.rescheduleRequests ?? [];

  return (
    <Dialog open={enabled} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appointment</DialogTitle>
          <DialogDescription>
            Booking, payment and reschedule history. Consultation notes are not readable
            here.
          </DialogDescription>
        </DialogHeader>
        {detail.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : detail.isError ? (
          <p className="text-sm text-destructive">{detail.error.userMessage}</p>
        ) : appointment ? (
          <dl className="grid gap-2 text-sm">
            <Row label="ID" value={shortId(appointment.id)} />
            <Row label="Scheduled" value={formatDateTime(appointment.startAt)} />
            <Row label="Status" value={humanise(appointment.status)} />
            <Row label="Doctor" value={shortId(appointment.doctorId)} />
            <Row
              label="Patient"
              value={`${appointment.visitPatient.name} (${shortId(appointment.patientId)})`}
            />
            <Row label="Fee" value={formatMoney(appointment.feeCents, appointment.currency)} />
            {appointment.cancelledAt ? (
              <Row
                label="Cancelled"
                value={`${formatDateTime(appointment.cancelledAt)}${
                  appointment.cancelledBy ? ` by ${appointment.cancelledBy}` : ""
                }${appointment.cancellationReason ? ` — ${appointment.cancellationReason}` : ""}`}
              />
            ) : null}
            <Row
              label="Payment"
              value={
                payment
                  ? `${humanise(payment.status)} · ${formatMoney(payment.amountCents, payment.currency)}${
                      payment.refundedCents > 0
                        ? ` · ${formatMoney(payment.refundedCents, payment.currency)} refunded`
                        : ""
                    }`
                  : "None"
              }
            />
            {reschedules.length > 0 ? (
              <Row
                label="Reschedule requests"
                value={reschedules
                  .map((r) => `${formatDateTime(r.proposedStartAt)} (${humanise(r.status)})`)
                  .join(", ")}
              />
            ) : null}
          </dl>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
