import type { ScheduleSettings, WorkingHour } from "@/lib/admin/api/types";

/** Sunday first, matching day_of_week 0..6 as the backend stores it. */
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

export function toRows(hours: WorkingHour[]): DayRow[] {
  const rows = blankWeek();
  for (const h of hours) {
    // Guarded rather than trusted: day_of_week arrives from the API, and an
    // out-of-range value would otherwise extend the array and render a stray
    // row for a day of the week that does not exist.
    if (!Number.isInteger(h.day_of_week) || h.day_of_week < 0 || h.day_of_week > 6) continue;
    rows[h.day_of_week] = {
      available: h.is_available,
      // Times arrive as HH:MM or HH:MM:SS depending on how the row was
      // written; <input type="time"> only accepts the former.
      start: h.start_time.slice(0, 5),
      end: h.end_time.slice(0, 5),
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

/**
 * The buffer field as it goes on the wire.
 *
 * "" means "leave it unset" and "0" means back-to-back consultations. Those
 * are different instructions, and the whole chain — this function, the DTO,
 * the domain type, the column and the event tag — keeps them apart. Collapsing
 * them here would hand the doctor the platform default gap forever, with
 * nothing logged to say why.
 */
export function bufferValue(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** The request body for PUT availability. */
export function toAvailabilityRequest(
  rows: DayRow[],
  slotDurationMinutes: number,
  buffer: string,
  maxPerDay: number,
) {
  return {
    working_hours: rows.map((r, day) => ({
      day_of_week: day,
      start_time: r.start,
      end_time: r.end,
      is_available: r.available,
    })),
    slot_duration_minutes: slotDurationMinutes,
    buffer_minutes: bufferValue(buffer),
    max_per_day: maxPerDay,
  };
}

/** The buffer as the editor should first display it. */
export function initialBuffer(settings: ScheduleSettings): string {
  return settings.buffer_minutes === null || settings.buffer_minutes === undefined
    ? ""
    : String(settings.buffer_minutes);
}
