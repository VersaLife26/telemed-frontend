import { AvailabilityEditor } from "@/components/consumer/availability-editor";
import { Alert } from "@/components/consumer/ui/Alert";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { apiFetch } from "@/lib/consumer/api/client";
import type { WorkingHour } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import type { ScheduleSettings } from "@/lib/consumer/features/practice";
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

  let hours: WorkingHour[] = [];
  let settings: ScheduleSettings | null = null;
  let error: string | null = null;
  try {
    const data = await apiFetch<WorkingHour[]>("/api/v1/doctors/me/availability", { token });
    hours = Array.isArray(data) ? data : [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load availability";
  }
  try {
    settings = await apiFetch<ScheduleSettings>("/api/v1/doctors/me/schedule-settings", {
      token,
    });
  } catch {
    settings = null;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHero {...HEROES.availability} />
        <Alert tone="danger" className="max-w-xl">
          {error}
        </Alert>
      </div>
    );
  }

  return <AvailabilityEditor initialHours={hours} initialSettings={settings} />;
}
