"use client";

import { useEffect, useState } from "react";

import { WeekGrid } from "@/components/consumer/calendar/week-grid";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, Paged, Schedule, WorkingHour } from "@/lib/consumer/api/types";
import {
  colomboDayKey,
  eventsByDay,
  gridWindow,
  shiftDay,
  weekDayKeys,
  weekStart,
} from "@/lib/consumer/features/calendar";

export function CalendarApp() {
  const todayKey = colomboDayKey(new Date());
  const mondayKey = weekStart(todayKey);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);

  useEffect(() => {
    let cancelled = false;
    const from = shiftDay(mondayKey, -1);
    const to = shiftDay(mondayKey, 8);
    Promise.all([
      browserApi<Paged<Appointment>>(
        `/appointments?from=${from}T00:00:00Z&to=${to}T00:00:00Z&pageSize=100`,
      ),
      browserApi<Schedule>("/doctors/me/schedule"),
    ]).then(([list, schedule]) => {
      if (cancelled) return;
      setAppointments(list.items);
      setWorkingHours(schedule.workingHours ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [mondayKey]);

  const dayKeys = weekDayKeys(mondayKey);
  const byDay = eventsByDay(appointments, dayKeys);
  const shown = dayKeys.flatMap((key) => byDay[key] ?? []);
  const window = gridWindow(shown, workingHours);

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-900">
      <p className="shrink-0 px-4 py-2 text-label text-white/80">This week</p>
      <div className="min-h-0 flex-1 overflow-auto bg-white p-3">
        <WeekGrid
          dayKeys={dayKeys}
          todayKey={todayKey}
          eventsByDayKey={byDay}
          hrefForEvent={() => null}
          window={window}
          workingHours={workingHours}
          leaveByDayKey={{}}
        />
      </div>
    </div>
  );
}
