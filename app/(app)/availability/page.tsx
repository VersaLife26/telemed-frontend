import Link from "next/link";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { apiFetch } from "@/lib/consumer/api/client";
import type { WorkingHour } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { hoursLine, weekdayLabel } from "@/lib/consumer/features/availability";

export default async function AvailabilityPage() {
  const token = await getAccessToken();
  if (!token) {
    return (
      <Card className="flex flex-col gap-4">
        <p className="text-body text-text-muted">Sign in to manage availability.</p>
        <Link href="/login" className="max-w-xs">
          <Button>Sign in</Button>
        </Link>
      </Card>
    );
  }

  let hours: WorkingHour[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<WorkingHour[]>("/api/v1/doctors/me/availability", { token });
    hours = Array.isArray(data) ? data : [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load availability";
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h1 className="text-h4 text-black">Working hours</h1>
        <p className="mt-2 text-body-sm text-text-muted">
          Loaded from doctor-service. Editing UI (PUT) can be added next; values below are live.
        </p>
      </Card>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {hours.map((h, i) => (
          <Card key={`${h.day_of_week}-${i}`}>
            <p className="text-h5 text-black">{weekdayLabel(h.day_of_week)}</p>
            <p className="mt-2 text-body text-text-muted">
              {hoursLine(h)}
            </p>
          </Card>
        ))}
      </div>
      {!error && hours.length === 0 ? (
        <Card>
          <p className="text-body text-text-muted">No working hours configured yet.</p>
        </Card>
      ) : null}
    </div>
  );
}
