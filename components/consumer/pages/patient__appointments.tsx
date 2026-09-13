"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { EarlyJoinDecision } from "@/components/consumer/early-join-decision";
import { RescheduleDecision } from "@/components/consumer/reschedule-decision";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, EarlyJoinOffer, RescheduleRequest } from "@/lib/consumer/api/types";
import { earlyJoinPath } from "@/lib/consumer/features/consult";
import {
  appointmentReschedulePath,
  appointmentsListPath,
  isConfirmedAppointment,
} from "@/lib/consumer/features/appointments";

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

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pending, setPending] = useState<Record<string, RescheduleRequest | null>>({});
  const [earlyJoin, setEarlyJoin] = useState<Record<string, EarlyJoinOffer | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
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
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-body text-text-muted">Loading appointments…</p>;
  }

  if (error && appointments.length === 0) {
    const signIn = /sign in|unauthorized|unauthorised|401/i.test(error);
    if (signIn) {
      return (
        <Card className="flex flex-col gap-4">
          <p className="text-body text-text-muted">Sign in to view appointments.</p>
          <Link href="/login" className="max-w-xs">
            <Button>Sign in</Button>
          </Link>
        </Card>
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      {appointments.map((a) => {
        const request = pending[a.id];
        const offer = earlyJoin[a.id];
        return (
          <Card key={a.id} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-body font-medium text-black">{a.specialty || "Consultation"}</p>
              <p className="text-body-sm text-text-muted">
                {a.start_at_local || a.start_at} · {a.status}
              </p>
              {request ? <RescheduleDecision request={request} onChanged={() => void load()} /> : null}
              {offer ? <EarlyJoinDecision offer={offer} onChanged={() => void load()} /> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/appointments/${a.id}/payment`}
                className="rounded-full bg-white px-4 py-2 text-body-sm text-primary"
              >
                Payment
              </Link>
              <Link
                href={`/appointments/${a.id}/waiting-room`}
                className="rounded-full bg-primary px-4 py-2 text-body-sm text-white"
              >
                Waiting room
              </Link>
              <Link
                href={`/appointments/${a.id}/summary`}
                className="rounded-full bg-white px-4 py-2 text-body-sm text-primary"
              >
                Summary
              </Link>
            </div>
          </Card>
        );
      })}
      {!error && appointments.length === 0 ? (
        <Card>
          <p className="text-body text-text-muted">No appointments yet.</p>
        </Card>
      ) : null}
    </div>
  );
}
