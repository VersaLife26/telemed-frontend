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
import type { AdminAppointment } from "@/lib/admin/api/types";
import { districtName } from "@/lib/admin/districts";
import { formatDateTime, humanise, shortId } from "@/lib/admin/format";

export function AppointmentDetailDialog({
  appointmentId,
  onClose,
}: {
  appointmentId: string | null;
  onClose: () => void;
}) {
  const enabled = appointmentId !== null;
  const detail = useApiQuery<AdminAppointment>(
    ["appointment-detail", appointmentId ?? ""],
    appointmentId ? endpoints.appointments.detail(appointmentId) : "",
    { enabled },
  );

  return (
    <Dialog open={enabled} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Appointment</DialogTitle>
          <DialogDescription>
            Scheduling projection only. Intake and notes are not readable here.
          </DialogDescription>
        </DialogHeader>
        {detail.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : detail.isError ? (
          <p className="text-sm text-destructive">{detail.error.userMessage}</p>
        ) : detail.data ? (
          <dl className="grid gap-2 text-sm">
            <Row label="ID" value={shortId(detail.data.appointment_id)} />
            <Row
              label="Scheduled"
              value={
                detail.data.scheduled_at ? formatDateTime(detail.data.scheduled_at) : "—"
              }
            />
            <Row label="Status" value={humanise(detail.data.status)} />
            <Row
              label="Doctor"
              value={detail.data.doctor_name ?? (detail.data.doctor_id ? shortId(detail.data.doctor_id) : "—")}
            />
            <Row
              label="Patient"
              value={
                detail.data.patient_reference ??
                (detail.data.patient_id ? shortId(detail.data.patient_id) : "—")
              }
            />
            <Row
              label="Specialty"
              value={detail.data.specialty_code ? humanise(detail.data.specialty_code) : "—"}
            />
            <Row label="District" value={districtName(detail.data.district)} />
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
