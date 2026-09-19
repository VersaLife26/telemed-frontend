import { CalendarDays } from "lucide-react";

import type { Appointment } from "@/lib/consumer/api/types";
import {
  appointmentAction,
  formatVisitClock,
  formatVisitDate,
} from "@/lib/consumer/features/patient-appointment";

import { Avatar } from "./Avatar";
import { ButtonLink } from "./Button";
import { StatusBadge } from "./StatusBadge";

/**
 * The next visit, as a torn-off ticket.
 *
 * The perforated rail and the coloured spine are the most recognisable thing
 * in the patient app, so the redesign keeps the idea and rebuilds the
 * materials: gradient spine, tinted rail, display-face clock. The time is the
 * largest element on the page because it is the one fact the patient opens
 * the app to check.
 */
export function VisitTicket({
  appointment,
  doctorName,
  doctorPhoto,
}: {
  appointment: Appointment;
  doctorName?: string | null;
  doctorPhoto?: string | null;
}) {
  const action = appointmentAction(appointment.id, appointment.status);
  const when = appointment.start_at_local || appointment.start_at;
  const title = doctorName || appointment.specialty || "Consultation";
  const specialty =
    doctorName && appointment.specialty && appointment.specialty !== doctorName
      ? appointment.specialty
      : null;

  return (
    <article className="relative overflow-hidden rounded-xl bg-surface shadow-lg">
      <div
        className="absolute inset-y-0 left-0 w-2.5 bg-[image:var(--gradient-cta)]"
        aria-hidden="true"
      />
      <div className="visit-ticket-rail absolute inset-y-3 right-0 w-3" aria-hidden="true" />

      <div className="flex flex-col gap-6 p-6 pl-8 pr-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-eyebrow text-brand">Next visit</p>
          <p className="mt-3 text-[3rem] font-bold leading-none tracking-[-0.035em] text-ink tabular-time sm:text-[3.5rem]">
            {formatVisitClock(when)}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <Avatar src={doctorPhoto} name={doctorName} size={40} />
            <div className="min-w-0">
              <p className="truncate text-h5 text-ink">{title}</p>
              <p className="truncate text-body-sm text-muted">
                {formatVisitDate(when)}
                {specialty ? ` · ${specialty}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <StatusBadge status={appointment.status} />
          </div>
        </div>

        {action ? (
          <ButtonLink href={action.href} size="lg" className="min-w-[10rem] shrink-0">
            {action.label}
          </ButtonLink>
        ) : null}
      </div>
    </article>
  );
}

export function EmptyVisitTicket() {
  return (
    <article className="relative overflow-hidden rounded-xl bg-surface shadow-md">
      <div className="absolute inset-y-0 left-0 w-2.5 bg-border-default" aria-hidden="true" />
      <div className="flex flex-col gap-6 p-6 pl-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-4">
          <span
            aria-hidden="true"
            className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-tint text-brand sm:flex"
          >
            <CalendarDays className="size-5" />
          </span>
          <div>
            <p className="text-eyebrow text-faint">Next visit</p>
            <p className="mt-2 text-h4 text-ink">Nothing booked</p>
            <p className="mt-2 max-w-prose text-body text-muted">
              Browse approved doctors and reserve a video slot when you need care.
            </p>
          </div>
        </div>
        <ButtonLink href="/doctors" size="lg" className="min-w-[10rem] shrink-0">
          Find a doctor
        </ButtonLink>
      </div>
    </article>
  );
}
