import { AvailabilityEditor } from "@/components/consumer/availability-editor";
import { Alert } from "@/components/consumer/ui/Alert";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Holiday, Schedule } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { colomboDayKey } from "@/lib/consumer/features/calendar";
import { PageHero } from "@/components/consumer/ui/PageHero";
import { HEROES } from "@/lib/consumer/heroes";

export default async function AvailabilityPage() {
  const token = await getAccessToken();
  if (!token) {
    return (
      <Card className="flex max-w-xl flex-col items-start gap-4">
        <p className="text-body text-muted">Sign in to manage availability.</p>
        <ButtonLink href="/login">Sign in</ButtonLink>
      </Card>
    );
  }

  let schedule: Schedule | null = null;
  let holidays: Holiday[] = [];
  let error: string | null = null;
  try {
    [schedule, holidays] = await Promise.all([
      apiFetch<Schedule>("/api/v1/doctors/me/schedule", { token }),
      apiFetch<Holiday[]>(`/api/v1/doctors/me/holidays?from=${colomboDayKey(new Date())}`, { token }),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load availability";
  }

  if (error || !schedule) {
    return (
      <div className="flex flex-col gap-6">
        <PageHero {...HEROES.availability} />
        <Alert tone="danger" className="max-w-xl">
          {error}
        </Alert>
      </div>
    );
  }

  return <AvailabilityEditor initialSchedule={schedule} initialHolidays={holidays} />;
}
