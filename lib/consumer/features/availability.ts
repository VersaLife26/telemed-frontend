import type { WorkingHour } from "@/lib/consumer/api/types";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function weekdayLabel(dayOfWeek: number): string {
  return WEEKDAYS[dayOfWeek] ?? `Day ${dayOfWeek}`;
}

/** "09:00" for 540 minutes past midnight; 1440 prints as "24:00". */
export function minuteToClock(minute: number): string {
  const m = Math.max(0, Math.min(1440, Math.round(minute)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Minutes past midnight for an "HH:MM" time input value. */
export function clockToMinute(value: string): number {
  const [hh, mm] = value.split(":");
  const hours = Number(hh);
  const minutes = Number(mm);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function hoursLine(hour: Pick<WorkingHour, "startMinute" | "endMinute">): string {
  return `${minuteToClock(hour.startMinute)} – ${minuteToClock(hour.endMinute)}`;
}
