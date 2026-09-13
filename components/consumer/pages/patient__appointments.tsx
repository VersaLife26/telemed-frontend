"use client";

import { useCallback, useEffect, useState } from "react";
import { EarlyJoinDecision } from "@/components/consumer/early-join-decision";
import { RescheduleDecision } from "@/components/consumer/reschedule-decision";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { StatusBadge } from "@/components/consumer/ui/StatusBadge";
import { AppointmentsSkeleton } from "@/components/consumer/ui/skeletons";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, EarlyJoinOffer, RescheduleRequest } from "@/lib/consumer/api/types";
import { earlyJoinPath } from "@/lib/consumer/features/consult";
import {
  appointmentReschedulePath,
  appointmentsListPath,
  isConfirmedAppointment,
} from "@/lib/consumer/features/appointments";
import {
  appointmentAction,
  formatVisitClock,
  formatVisitDate,
  isUpcomingAppointment,
} from "@/lib/consumer/features/patient-appointment";

async function pendingByAppointment(
  appointments: Appointment[],
): Promise<Record<string, RescheduleRequest | null>> {
  const confirmed = appointments.filter(isConfirmedAppointment);
  const entries = await Promise.all(
    confirmed.map(async (a) => {
      try {
        const items = await browserApi<RescheduleRequest[]>(appointmentReschedulePath(a.id));
        const pending = (Array.isArray(items) ? items : []).find((r) => r.status === "pending") ?? null;
        return [a.id, pending] as const;
      } catch {
        return [a.id, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

async function earlyJoinByAppointment(
  appointments: Appointment[],
): Promise<Record<string, EarlyJoinOffer | null>> {
  const confirmed = appointments.filter(isConfirmedAppointment);
  const entries = await Promise.all(
    confirmed.map(async (a) => {
      try {
        const offer = await browserApi<EarlyJoinOffer>(earlyJoinPath(a.id));
        return [a.id, offer] as const;
      } catch {
        return [a.id, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

function AppointmentRow({
  appointment,
  request,
  offer,
  onChanged,
}: {
  appointment: Appointment;
  request: RescheduleRequest | null;
  offer: EarlyJoinOffer | null;
  onChanged: () => void;
}) {
  const action = appointmentAction(appointment.id, appointment.status);
  const when = appointment.start_at_local || appointment.start_at;

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body font-medium text-ink">{appointment.specialty || "Consultation"}</p>
          <StatusBadge status={appointment.status} />
        </div>
        <p className="mt-1 text-body-sm text-text-muted">
          {formatVisitDate(when)} · {formatVisitClock(when)}
        </p>
        {request ? (
          <div className="mt-3">
            <RescheduleDecision request={request} onChanged={onChanged} />
          </div>
        ) : null}
        {offer ? (
          <div className="mt-3">
            <EarlyJoinDecision offer={offer} onChanged={onChanged} />
          </div>
        ) : null}
      </div>
      {action ? (
        <ButtonLink href={action.href} className="min-h-11 shrink-0">
          {action.label}
        </ButtonLink>
      ) : null}
    </Card>
  );
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pending, setPending] = useState<Record<string, RescheduleRequest | null>>({});
  const [earlyJoin, setEarlyJoin] = useState<Record<string, EarlyJoinOffer | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await browserApi<Appointment[]>(appointmentsListPath());
      const list = Array.isArray(data) ? data : [];
      setAppointments(list);
      const [reschedule, offers] = await Promise.all([
        pendingByAppointment(list),
        earlyJoinByAppointment(list),
      ]);
      setPending(reschedule);
      setEarlyJoin(offers);
    } catch (e) {
      setAppointments([]);
      setPending({});
      setEarlyJoin({});
      setError(e instanceof Error ? e.message : "Could not load visits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <AppointmentsSkeleton />;
  }

  if (error && appointments.length === 0) {
    const signIn = /sign in|unauthorized|unauthorised|401/i.test(error);
    if (signIn) {
      return (
        <EmptyState
          title="Sign in to view visits"
          body="Your upcoming and past consults live here after you sign in."
          action={{ href: "/login", label: "Sign in" }}
        />
      );
    }
  }

  const upcoming = appointments.filter((a) => isUpcomingAppointment(a));
  const past = appointments.filter((a) => !isUpcomingAppointment(a));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-h3 text-ink">Appointments</h1>
        <p className="mt-1 text-body text-text-muted">Pay, join, or read a visit summary from here.</p>
      </header>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      {!error && appointments.length === 0 ? (
        <EmptyState
          title="No visits yet"
          body="Book a video consult and it will show up here with the next step."
          action={{ href: "/doctors", label: "Find a doctor" }}
        />
      ) : null}

      {upcoming.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-h5 text-ink">Upcoming</h2>
          {upcoming.map((a) => (
            <AppointmentRow
              key={a.id}
              appointment={a}
              request={pending[a.id] ?? null}
              offer={earlyJoin[a.id] ?? null}
              onChanged={() => void load()}
            />
          ))}
        </section>
      ) : null}

      {past.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-h5 text-ink">Past</h2>
          {past.map((a) => (
            <AppointmentRow
              key={a.id}
              appointment={a}
              request={pending[a.id] ?? null}
              offer={earlyJoin[a.id] ?? null}
              onChanged={() => void load()}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
