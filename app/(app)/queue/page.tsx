import Link from "next/link";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { ReadyForNextButton } from "@/components/consumer/ready-for-next-button";
import { RescheduleRequestForm } from "@/components/consumer/reschedule-request-form";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Appointment, RescheduleRequest } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { afterEndPath, callPath } from "@/lib/consumer/features/consult";
import { prescriptionPagePath } from "@/lib/consumer/features/prescription";

async function pendingByAppointment(
  token: string,
  appointments: Appointment[],
): Promise<Record<string, RescheduleRequest | null>> {
  const entries = await Promise.all(
    appointments.map(async (a) => {
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

export default async function QueuePage() {
  const token = await getAccessToken();
  if (!token) {
    return (
      <Card className="flex flex-col gap-4">
        <p className="text-body text-text-muted">Sign in to load your consultation queue.</p>
        <Link href="/login" className="max-w-xs">
          <Button>Sign in</Button>
        </Link>
      </Card>
    );
  }

  let appointments: Appointment[] = [];
  let pending: Record<string, RescheduleRequest | null> = {};
  let error: string | null = null;
  try {
    const data = await apiFetch<Appointment[]>(
      "/api/v1/appointments?per_page=50&status=confirmed",
      { token },
    );
    appointments = Array.isArray(data) ? data : [];
    pending = await pendingByAppointment(token, appointments);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load queue";
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <p className="text-body font-medium text-black">Finished early?</p>
        <p className="text-body-sm text-text-muted">
          After you end a call, you can ask only the next patient if they can join now. Later
          slots stay where they are.
        </p>
        <ReadyForNextButton />
      </Card>
      {error ? (
        <Card>
          <p className="text-body-sm text-danger">{error}</p>
          <p className="mt-2 text-body-sm text-text-muted">
            Doctor appointment lists need a JWT with telemed_doctor_id. If you see a claim error,
            the user-service token for this doctor account may need that claim set.
          </p>
        </Card>
      ) : null}
      {appointments.map((a) => (
        <Card
          key={a.id}
          className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <p className="text-body font-medium text-black">{a.specialty || "Consultation"}</p>
            <p className="text-body-sm text-text-muted">
              {a.start_at_local || a.start_at} · {a.status}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <Link
                href={callPath(a.id)}
                className="rounded-full bg-primary px-4 py-2 text-body-sm text-white"
              >
                Join call
              </Link>
              <Link
                href={afterEndPath("doctor", a.id)}
                className="rounded-full bg-white px-4 py-2 text-body-sm text-primary"
              >
                Notes
              </Link>
              <Link
                href={prescriptionPagePath(a.id)}
                className="rounded-full bg-white px-4 py-2 text-body-sm text-primary"
              >
                Rx
              </Link>
            </div>
            <RescheduleRequestForm
              appointmentId={a.id}
              pending={pending[a.id] ?? null}
              startAt={a.start_at}
            />
          </div>
        </Card>
      ))}
      {!error && appointments.length === 0 ? (
        <Card>
          <p className="text-body text-text-muted">No confirmed appointments in queue.</p>
        </Card>
      ) : null}
    </div>
  );
}
