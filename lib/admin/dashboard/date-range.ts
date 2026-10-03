import { COLOMBO_TIME_ZONE } from "@/lib/admin/format";

/** Matches `LocalDateRange.MaxDays` on the API. */
export const DASHBOARD_MAX_RANGE_DAYS = 366;

export const DASHBOARD_PRESET_DAYS = [7, 30, 90] as const;

export type DashboardPresetDays = (typeof DASHBOARD_PRESET_DAYS)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date for “today” in the platform zone (Asia/Colombo). */
export function colomboToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: COLOMBO_TIME_ZONE }).format(now);
}

export function parseIsoDateOnly(value: string | undefined): string | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  return value;
}

export function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + delta);
  const dt = new Date(utc);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Inclusive day count between two ISO dates. */
export function inclusiveDayCount(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const start = Date.UTC(y1, m1 - 1, d1);
  const end = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((end - start) / 86_400_000) + 1;
}

function clampRange(from: string, to: string, today: string): { from: string; to: string } {
  const end = to > today ? today : to;
  let start = from > end ? end : from;
  if (inclusiveDayCount(start, end) > DASHBOARD_MAX_RANGE_DAYS) {
    start = addDaysIso(end, 1 - DASHBOARD_MAX_RANGE_DAYS);
  }
  return { from: start, to: end };
}

export function presetRange(days: DashboardPresetDays, today = colomboToday()): {
  from: string;
  to: string;
} {
  return { from: addDaysIso(today, 1 - days), to: today };
}

export function resolveDashboardRange(params: {
  from?: string;
  to?: string;
  days?: string;
}): { from: string; to: string } {
  const today = colomboToday();
  const fromParam = parseIsoDateOnly(params.from);
  const toParam = parseIsoDateOnly(params.to);

  if (fromParam && toParam) {
    return clampRange(fromParam, toParam, today);
  }

  const parsedDays = Number.parseInt(params.days ?? "", 10);
  const preset = (DASHBOARD_PRESET_DAYS as readonly number[]).includes(parsedDays)
    ? (parsedDays as DashboardPresetDays)
    : 30;

  return presetRange(preset, today);
}

export function matchingPresetDays(
  from: string,
  to: string,
  today = colomboToday(),
): DashboardPresetDays | null {
  if (to !== today) return null;
  const count = inclusiveDayCount(from, to);
  return (DASHBOARD_PRESET_DAYS as readonly number[]).includes(count)
    ? (count as DashboardPresetDays)
    : null;
}

export function dashboardRangeHref(from: string, to: string): string {
  const q = new URLSearchParams({ from, to });
  return `/?${q.toString()}`;
}

export function dashboardRangeLabel(from: string, to: string): string {
  if (from === to) return `on ${from}`;
  return `from ${from} to ${to}`;
}
