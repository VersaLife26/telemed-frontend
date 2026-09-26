import { CalendarDays } from "lucide-react";

import { WeekGrid } from "@/components/consumer/calendar/week-grid";
import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Appointment, Holiday, Paged, Schedule, WorkingHour } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import {
  colomboDayKey,
  eventsByDay,
  gridWindow,
  isDayKey,
  shiftDay,
  shiftWeek,
  weekDayKeys,
  weekRangeLabel,
  weekStart,
  type PlacedEvent,
} from "@/lib/consumer/features/calendar";
import { afterEndPath, callPath } from "@/lib/consumer/features/consult";
import { PageHero } from "@/components/consumer/ui/PageHero";
import { HEROES } from "@/lib/consumer/heroes";

/**
 * The doctor's week, as a timetable. The query window is a day wider on each
 * side than the Colombo week so no UTC instant near midnight is missed; the
 * grid buckets by Colombo day and drops the rest.
 */
const APPOINTMENT_PAGE = 100;

async function load(token: string, mondayKey: string) {
  const sundayKey = weekDayKeys(mondayKey)[6] ?? mondayKey;
  const from = shiftDay(mondayKey, -1);
  const to = shiftDay(sundayKey, 1);

  const [appointments, workingHours, holidays] = await Promise.all([
    apiFetch<Paged<Appointment>>(
      `/api/v1/appointments?from=${from}T00:00:00Z&to=${to}T00:00:00Z&pageSize=${APPOINTMENT_PAGE}`,
      { token },
    )
      .then((data) => data.items)
      .catch((e: unknown) => (e instanceof Error ? e : new Error("Could not load appointments"))),
    apiFetch<Schedule>("/api/v1/doctors/me/schedule", { token })
      .then((data) => data.workingHours ?? [])
      .catch(() => [] as WorkingHour[]),
    apiFetch<Holiday[]>(`/api/v1/doctors/me/holidays?from=${mondayKey}&to=${sundayKey}`, { token })
      .catch(() => [] as Holiday[]),
  ]);

  return { appointments, workingHours, holidays };
}

/** Where a block goes when clicked: into the call, or into its notes once past. */
function hrefForEvent(event: PlacedEvent): string | null {
  if (event.status === "completed") return afterEndPath("doctor", event.id);
  if (event.status === "confirmed") return callPath(event.id);
  return null;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const token = await getAccessToken();
  if (!token) {
    return (
      <Card className="flex max-w-xl flex-col items-start gap-4">
        <p className="text-body text-muted">Sign in to see your week.</p>
        <ButtonLink href="/login">Sign in</ButtonLink>
      </Card>
    );
  }

  const todayKey = colomboDayKey(new Date());
  const { week } = await searchParams;
  // An unparseable ?week= falls back to this week rather than erroring: a
  // stale bookmark should still show the doctor something useful.
  const mondayKey = weekStart(isDayKey(week) ? week : todayKey);

  const { appointments, workingHours, holidays } = await load(token, mondayKey);
  const loadError = appointments instanceof Error ? appointments.message : null;
  const list = appointments instanceof Error ? [] : appointments;

  const dayKeys = weekDayKeys(mondayKey);
  const byDay = eventsByDay(list, dayKeys);
  const shown = dayKeys.flatMap((key) => byDay[key] ?? []);
  const window = gridWindow(shown, workingHours);

  const leaveByDayKey: Record<string, string> = {};
  for (const holiday of holidays) {
    if (!holiday.date) continue;
    leaveByDayKey[holiday.date] =
      holiday.reason || (holiday.doctorId ? "Leave" : "Platform closure");
  }

  const thisWeekKey = weekStart(todayKey);

  return (
    <div className="flex flex-col gap-6">
      <PageHero {...HEROES.calendar} lede={`${weekRangeLabel(mondayKey)} · Asia/Colombo`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">
            {shown.length} {shown.length === 1 ? "visit" : "visits"}
          </Badge>
          <ButtonLink
            href={`/calendar?week=${shiftWeek(mondayKey, -1)}`}
            size="sm"
            variant="outline"
            aria-label="Previous week"
          >
            ←
          </ButtonLink>
          <ButtonLink
            href="/calendar"
            size="sm"
            variant={mondayKey === thisWeekKey ? "secondary" : "outline"}
          >
            This week
          </ButtonLink>
          <ButtonLink
            href={`/calendar?week=${shiftWeek(mondayKey, 1)}`}
            size="sm"
            variant="outline"
            aria-label="Next week"
          >
            →
          </ButtonLink>
        </div>
      </PageHero>

      {loadError ? (
        <Alert tone="danger" title="Couldn’t load appointments">
          {loadError} The grid below still shows your working hours and leave.
        </Alert>
      ) : null}

      <WeekGrid
        dayKeys={dayKeys}
        todayKey={todayKey}
        eventsByDayKey={byDay}
        hrefForEvent={hrefForEvent}
        window={window}
        workingHours={workingHours}
        leaveByDayKey={leaveByDayKey}
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-body-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-sm border border-blue-200 bg-blue-50" />
          Booked visit
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-sm bg-blue-50/60 ring-1 ring-border-subtle" />
          Working hours
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-sm bg-ink-50 ring-1 ring-border-subtle" />
          Leave
        </span>
        <span className="inline-flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="size-4" />
          Cancelled visits are not shown.
        </span>
      </div>
    </div>
  );
}
