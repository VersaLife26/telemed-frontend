import Link from "next/link";
import { AvailabilityEditor } from "@/components/consumer/availability-editor";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { apiFetch } from "@/lib/consumer/api/client";
import type { WorkingHour } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import type { ScheduleSettings } from "@/lib/consumer/features/practice";

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
      <Card className="flex flex-col gap-3">
        <h1 className="text-h4 text-black">Working hours</h1>
        <p className="text-body-sm text-danger">{error}</p>
      </Card>
    );
  }

  return <AvailabilityEditor initialHours={hours} initialSettings={settings} />;
}
