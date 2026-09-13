import type { Appointment } from "@/lib/consumer/api/types";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { StatusBadge } from "@/components/consumer/ui/StatusBadge";
import {
  appointmentAction,
  formatVisitClock,
  formatVisitDate,
} from "@/lib/consumer/features/patient-appointment";

export function VisitTicket({
  appointment,
  doctorName,
}: {
  appointment: Appointment;
  doctorName?: string | null;
}) {
  const action = appointmentAction(appointment.id, appointment.status);
  const when = appointment.start_at_local || appointment.start_at;
  const title = doctorName || appointment.specialty || "Consultation";
  const specialty =
    doctorName && appointment.specialty && appointment.specialty !== doctorName
      ? appointment.specialty
      : null;

  return (
    <article className="relative overflow-hidden rounded-[20px] bg-paper shadow-[var(--shadow-ticket)]">
      <div className="absolute inset-y-0 left-0 w-2 bg-primary" aria-hidden="true" />
      <div className="visit-ticket-rail absolute inset-y-3 right-0 w-3" aria-hidden="true" />
      <div className="flex flex-col gap-6 p-6 pl-8 pr-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-[0.16em] text-text-label">Next visit</p>
          <p className="mt-3 text-[48px] font-semibold leading-none tracking-tight text-ink tabular-time sm:text-[56px]">
            {formatVisitClock(when)}
          </p>
          <p className="mt-3 truncate text-h5 text-ink">{title}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-body-sm text-text-muted">
              {formatVisitDate(when)}
              {specialty ? ` · ${specialty}` : ""}
            </span>
            <StatusBadge status={appointment.status} />
          </div>
        </div>
        {action ? (
          <ButtonLink href={action.href} className="min-h-12 min-w-[10rem] shrink-0">
            {action.label}
          </ButtonLink>
        ) : null}
      </div>
    </article>
  );
}

export function EmptyVisitTicket() {
  return (
    <article className="relative overflow-hidden rounded-[20px] bg-paper shadow-[var(--shadow-ticket)]">
      <div className="absolute inset-y-0 left-0 w-2 bg-border" aria-hidden="true" />
      <div className="flex flex-col gap-6 p-6 pl-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-caption uppercase tracking-[0.16em] text-text-label">Next visit</p>
          <p className="mt-3 text-h4 text-ink">Nothing booked</p>
          <p className="mt-2 max-w-prose text-body text-text-muted">
            Browse approved doctors and reserve a video slot when you need care.
          </p>
        </div>
        <ButtonLink href="/doctors" className="min-h-12 min-w-[10rem] shrink-0">
          Find a doctor
        </ButtonLink>
      </div>
    </article>
  );
}
