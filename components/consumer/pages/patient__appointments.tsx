import Link from "next/link";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { EarlyJoinDecision } from "@/components/consumer/early-join-decision";
import { RescheduleDecision } from "@/components/consumer/reschedule-decision";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Appointment, EarlyJoinOffer, RescheduleRequest } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";

async function pendingByAppointment(
  token: string,
  appointments: Appointment[],
): Promise<Record<string, RescheduleRequest | null>> {
  const confirmed = appointments.filter((a) => a.status === "confirmed");
  const entries = await Promise.all(
    confirmed.map(async (a) => {
      try {
        const items = await apiFetch<RescheduleRequest[]>(
          `/api/v1/appointments/${a.id}/reschedule-requests`,
          { token },
        );
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
  token: string,
  appointments: Appointment[],
): Promise<Record<string, EarlyJoinOffer | null>> {
  const confirmed = appointments.filter((a) => a.status === "confirmed");
  const entries = await Promise.all(
    confirmed.map(async (a) => {
      try {
        const offer = await apiFetch<EarlyJoinOffer>(`/api/v1/consultations/${a.id}/early-join`, {
          token,
        });
        return [a.id, offer] as const;
      } catch {
        return [a.id, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

export default async function AppointmentsPage() {
  const token = await getAccessToken();
  if (!token) {
    return (
      <Card className="flex flex-col gap-4">
        <p className="text-body text-text-muted">Sign in to view appointments.</p>
        <Link href="/login" className="max-w-xs">
          <Button>Sign in</Button>
        </Link>
      </Card>
    );
  }

  let appointments: Appointment[] = [];
  let pending: Record<string, RescheduleRequest | null> = {};
  let earlyJoin: Record<string, EarlyJoinOffer | null> = {};
  let error: string | null = null;
  try {
    const data = await apiFetch<Appointment[]>("/api/v1/appointments?per_page=50", {
      token,
    });
    appointments = Array.isArray(data) ? data : [];
    const [reschedule, offers] = await Promise.all([
      pendingByAppointment(token, appointments),
      earlyJoinByAppointment(token, appointments),
    ]);
    pending = reschedule;
    earlyJoin = offers;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load";
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
              {request ? <RescheduleDecision request={request} /> : null}
              {offer ? <EarlyJoinDecision offer={offer} /> : null}
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
