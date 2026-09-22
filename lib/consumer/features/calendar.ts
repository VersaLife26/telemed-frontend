import type { Appointment, WorkingHour } from "@/lib/consumer/api/types";
import { specialtyLabel } from "@/lib/consumer/features/doctor-search";

const COLOMBO = "Asia/Colombo";
const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEK_DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/**
 * The week grid is a Colombo-local view of instants that arrive as UTC.
 *
 * Everything below therefore converts through Intl with an explicit time zone
 * rather than the runtime's local one: the server renders this page, and the
 * server is not in Colombo. `start_at_local` is not used for positioning —
 * it is a display string, and parsing it would make the grid depend on a
 * format the API does not promise.
 *
 * Day arithmetic runs on yyyy-mm-dd keys held at UTC noon. Colombo has no
 * daylight saving, so noon can never cross a date boundary under any offset.
 */

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: COLOMBO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: COLOMBO,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** yyyy-mm-dd for the Colombo calendar day an instant falls on. */
export function colomboDayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dayKeyFormat.format(date);
}

/** Minutes past Colombo midnight for an instant. */
export function colomboMinutes(value: string | Date): number {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const [hh, mm] = clockFormat.format(date).split(":");
  return Number(hh) * 60 + Number(mm);
}

function keyToNoon(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
}

function noonToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** True for a well-formed yyyy-mm-dd that names a real day. */
export function isDayKey(raw: string | undefined | null): raw is string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  return noonToKey(keyToNoon(raw)) === raw;
}

/** The Monday of the week containing `dayKey`. */
export function weekStart(dayKey: string): string {
  const noon = keyToNoon(dayKey);
  // getUTCDay is 0 for Sunday; Monday-first weeks want Sunday to fall back six.
  const backToMonday = (noon.getUTCDay() + 6) % 7;
  return noonToKey(new Date(noon.getTime() - backToMonday * DAY_MS));
}

export function shiftWeek(mondayKey: string, weeks: number): string {
  return noonToKey(new Date(keyToNoon(mondayKey).getTime() + weeks * 7 * DAY_MS));
}

/** Move a yyyy-mm-dd key by a number of civil days. */
export function shiftDay(dayKey: string, days: number): string {
  return noonToKey(new Date(keyToNoon(dayKey).getTime() + days * DAY_MS));
}

/** The next `count` Colombo civil dates, starting at today (or `from`). */
export function upcomingDayKeys(count: number, from: Date = new Date()): string[] {
  const start = colomboDayKey(from);
  return Array.from({ length: count }, (_, i) => shiftDay(start, i));
}

/** "Sat" for a day key. Noon-UTC is the same calendar day in Colombo. */
export function dayKeyWeekday(dayKey: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(keyToNoon(dayKey));
}

/** Seven yyyy-mm-dd keys, Monday first. */
export function weekDayKeys(mondayKey: string): string[] {
  const start = keyToNoon(mondayKey).getTime();
  return Array.from({ length: 7 }, (_, i) => noonToKey(new Date(start + i * DAY_MS)));
}

/** "Mon 22 Sep" style label for a column header. */
export function dayKeyLabel(dayKey: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(keyToNoon(dayKey));
}

/** "22 – 28 September 2026", collapsing the month when both ends share one. */
export function weekRangeLabel(mondayKey: string): string {
  const from = keyToNoon(mondayKey);
  const to = keyToNoon(shiftWeek(mondayKey, 1));
  to.setUTCDate(to.getUTCDate() - 1);
  const month = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long" });
  const year = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", year: "numeric" });
  const sameMonth = month.format(from) === month.format(to) && year.format(from) === year.format(to);
  if (sameMonth) {
    return `${from.getUTCDate()} – ${to.getUTCDate()} ${month.format(to)} ${year.format(to)}`;
  }
  return `${from.getUTCDate()} ${month.format(from)} – ${to.getUTCDate()} ${month.format(to)} ${year.format(to)}`;
}

/** "9:00 AM" — the mock's gutter and block format. */
export function minuteLabel(minute: number): string {
  const total = ((Math.round(minute) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

/** "09:00" or "09:00:00" from the availability API to minutes. */
export function parseClock(value: string): number {
  const [hh, mm] = value.split(":");
  const hours = Number(hh);
  const minutes = Number(mm);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

/**
 * Statuses that no longer occupy the doctor's time. A cancelled visit is not
 * on the schedule, and drawing it would make a free afternoon look booked.
 */
const OFF_SCHEDULE = new Set(["cancelled", "canceled", "refunded", "expired", "no_show"]);

export type CalendarEvent = {
  id: string;
  title: string;
  status?: string;
  /** Minutes past Colombo midnight. */
  startMinute: number;
  endMinute: number;
  startLabel: string;
  endLabel: string;
};

export type PlacedEvent = CalendarEvent & {
  /** 0-based column within its overlap cluster. */
  lane: number;
  /** How many columns that cluster needs. */
  lanes: number;
};

const DEFAULT_DURATION_MIN = 30;

/** Null when the appointment has no usable start, or is off the schedule. */
export function toCalendarEvent(
  appointment: Appointment,
): { dayKey: string; event: CalendarEvent } | null {
  const start = appointment.start_at;
  if (!start) return null;
  if (OFF_SCHEDULE.has((appointment.status || "").toLowerCase())) return null;

  const dayKey = colomboDayKey(start);
  if (!dayKey) return null;

  const startMinute = colomboMinutes(start);
  // An end that is missing, unparseable, or before the start would draw a
  // zero- or negative-height block, so fall back to a nominal slot length.
  let endMinute = appointment.end_at ? colomboMinutes(appointment.end_at) : 0;
  if (!appointment.end_at || endMinute <= startMinute) {
    endMinute = startMinute + DEFAULT_DURATION_MIN;
  }

  return {
    dayKey,
    event: {
      id: appointment.id,
      title:
        appointment.visit_patient_name ||
        appointment.counterpart_name ||
        appointment.patient_name ||
        (appointment.specialty ? specialtyLabel(appointment.specialty) : "Consultation"),
      status: appointment.status,
      startMinute,
      endMinute: Math.min(endMinute, 1440),
      startLabel: minuteLabel(startMinute),
      endLabel: minuteLabel(endMinute),
    },
  };
}

/** Events for each of `dayKeys`, each list already sorted and laid out. */
export function eventsByDay(
  appointments: Appointment[],
  dayKeys: string[],
): Record<string, PlacedEvent[]> {
  const buckets: Record<string, CalendarEvent[]> = {};
  for (const key of dayKeys) buckets[key] = [];

  for (const appointment of appointments) {
    const placed = toCalendarEvent(appointment);
    if (!placed) continue;
    buckets[placed.dayKey]?.push(placed.event);
  }

  const out: Record<string, PlacedEvent[]> = {};
  for (const key of dayKeys) out[key] = placeEvents(buckets[key] ?? []);
  return out;
}

/**
 * Side-by-side columns for overlapping events.
 *
 * Lanes are counted per *cluster* of transitively overlapping events, not
 * across the whole day: two appointments at 9am must not squeeze every other
 * block on that day to half width.
 */
export function placeEvents(events: CalendarEvent[]): PlacedEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute,
  );

  const out: PlacedEvent[] = [];
  let cluster: PlacedEvent[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  function flush() {
    const lanes = laneEnds.length || 1;
    for (const event of cluster) out.push({ ...event, lanes });
    cluster = [];
    laneEnds = [];
  }

  for (const event of sorted) {
    if (cluster.length && event.startMinute >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }

    let lane = laneEnds.findIndex((end) => end <= event.startMinute);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(event.endMinute);
    } else {
      laneEnds[lane] = event.endMinute;
    }

    cluster.push({ ...event, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, event.endMinute);
  }
  if (cluster.length) flush();

  return out;
}

export type GridWindow = { startMinute: number; endMinute: number; hours: number[] };

const FALLBACK_START = 8 * 60;
const FALLBACK_END = 18 * 60;

/**
 * The visible band of the day, on whole hours.
 *
 * Widened to cover every event and every available working hour, so nothing
 * is ever drawn outside the grid it is positioned against.
 */
export function gridWindow(
  events: PlacedEvent[],
  workingHours: WorkingHour[] = [],
): GridWindow {
  let start = FALLBACK_START;
  let end = FALLBACK_END;

  for (const hour of workingHours) {
    if (!hour.is_available) continue;
    start = Math.min(start, parseClock(hour.start_time));
    end = Math.max(end, parseClock(hour.end_time));
  }
  for (const event of events) {
    start = Math.min(start, event.startMinute);
    end = Math.max(end, event.endMinute);
  }

  const startMinute = Math.max(0, Math.floor(start / 60) * 60);
  const endMinute = Math.min(1440, Math.ceil(end / 60) * 60);
  const hours: number[] = [];
  for (let m = startMinute; m <= endMinute; m += 60) hours.push(m);

  return { startMinute, endMinute, hours };
}

/** The available working hours for a weekday, as minute ranges. */
export function workingBands(
  workingHours: WorkingHour[],
  dayOfWeek: number,
): Array<{ startMinute: number; endMinute: number }> {
  return workingHours
    .filter((h) => h.day_of_week === dayOfWeek && h.is_available)
    .map((h) => ({ startMinute: parseClock(h.start_time), endMinute: parseClock(h.end_time) }))
    .filter((band) => band.endMinute > band.startMinute);
}

/** getUTCDay-compatible weekday index (0 = Sunday) for a yyyy-mm-dd key. */
export function dayOfWeek(dayKey: string): number {
  return keyToNoon(dayKey).getUTCDay();
}

/** Percent offsets for absolute positioning inside a day column. */
export function bandStyle(
  window: GridWindow,
  startMinute: number,
  endMinute: number,
): { top: string; height: string } {
  const span = Math.max(1, window.endMinute - window.startMinute);
  const top = ((startMinute - window.startMinute) / span) * 100;
  const height = ((endMinute - startMinute) / span) * 100;
  return { top: `${Math.max(0, top)}%`, height: `${Math.max(0, Math.min(100 - top, height))}%` };
}
