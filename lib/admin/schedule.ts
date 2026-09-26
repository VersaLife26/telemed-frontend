import type { Schedule, UpdateScheduleRequest, WorkingHour } from "@/lib/admin/api/types";

/** Sunday first, matching dayOfWeek 0..6 as the backend stores it. */
export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface DayRow {
  available: boolean;
  start: string;
  end: string;
}

/** A doctor with no saved schedule gets a sensible blank week, not an error. */
export function blankWeek(): DayRow[] {
  return DAYS.map(() => ({ available: false, start: "09:00", end: "17:00" }));
}

/** Minutes from midnight → "HH:MM". 1440 (end of day) clamps to 23:59, the last value a time input accepts. */
export function minutesToTime(minutes: number): string {
  const clamped = Math.min(Math.max(0, minutes), 1439);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" → minutes from midnight. */
export function timeToMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * One row per weekday. A day with no working-hours entry is off. The editor
 * holds one block per day; if a day carries several, the first is shown.
 */
export function toRows(hours: readonly WorkingHour[]): DayRow[] {
  const rows = blankWeek();
  const seen = new Set<number>();
  for (const h of hours) {
    // Guarded rather than trusted: an out-of-range value would otherwise
    // extend the array and render a row for a day that does not exist.
    if (!Number.isInteger(h.dayOfWeek) || h.dayOfWeek < 0 || h.dayOfWeek > 6) continue;
    if (seen.has(h.dayOfWeek)) continue;
    seen.add(h.dayOfWeek);
    rows[h.dayOfWeek] = {
      available: true,
      start: minutesToTime(h.startMinute),
      end: minutesToTime(h.endMinute),
    };
  }
  return rows;
}

/** A day is invalid if it is on and does not describe a forward interval. */
export function dayError(row: DayRow): string | null {
  if (!row.available) return null;
  if (!row.start || !row.end) return "Set both a start and an end time.";
  if (row.start >= row.end) return "The end time must be after the start time.";
  return null;
}

export type ScheduleSettings = Omit<UpdateScheduleRequest, "workingHours">;

/** The slot settings as the editor starts with them, filling gaps with the platform's usual values. */
export function initialSettings(schedule: Schedule): ScheduleSettings {
  return {
    slotDurationMinutes: schedule.slotDurationMinutes || 15,
    bufferMinutes: schedule.bufferMinutes ?? 0,
    maxPerDay: schedule.maxPerDay ?? 0,
    advanceDays: schedule.advanceDays || 30,
    timezone: schedule.timezone || "Asia/Colombo",
  };
}

/**
 * The request body for PUT doctors/{id}/schedule. The API replaces the whole
 * week, so days that are off are simply absent.
 */
export function toScheduleRequest(rows: DayRow[], settings: ScheduleSettings): UpdateScheduleRequest {
  return {
    ...settings,
    workingHours: rows.flatMap((r, day) =>
      r.available
        ? [{ dayOfWeek: day, startMinute: timeToMinutes(r.start), endMinute: timeToMinutes(r.end) }]
        : [],
    ),
  };
}
