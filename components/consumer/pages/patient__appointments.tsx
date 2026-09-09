import Link from "next/link";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Appointment } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";

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
  let error: string | null = null;
  try {
    const data = await apiFetch<Appointment[]>("/api/v1/appointments?per_page=50", {
      token,
    });
    appointments = Array.isArray(data) ? data : [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load";
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      {appointments.map((a) => (
        <Card key={a.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-body font-medium text-black">{a.specialty || "Consultation"}</p>
            <p className="text-body-sm text-text-muted">
              {a.start_at_local || a.start_at} · {a.status}
            </p>
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
      ))}
      {!error && appointments.length === 0 ? (
        <Card>
          <p className="text-body text-text-muted">No appointments yet.</p>
        </Card>
      ) : null}
    </div>
  );
}
