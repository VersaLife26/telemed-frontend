/**
 * Presentation formatting.
 *
 * Timestamps are stored and transported as UTC (AGENT-BRIEF §3) and converted
 * to Asia/Colombo exactly here, at the presentation edge. Nothing upstream of
 * this file knows what a local time is.
 */

export const COLOMBO_TIME_ZONE = "Asia/Colombo";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: COLOMBO_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: COLOMBO_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const shortDayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: COLOMBO_TIME_ZONE,
  month: "short",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: COLOMBO_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** "12 Aug 2026, 14:05" in Colombo time. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : "—";
}

/** "12 Aug 2026" in Colombo time. */
export function formatDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "—";
}

/** "12 Aug", for chart axes where the year is implied by the range. */
export function formatShortDay(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? shortDayFormatter.format(date) : "";
}

/** "14:05:32" in Colombo time. */
export function formatTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : "—";
}

/** "3 minutes ago" / "in 2 hours". */
export function formatRelative(
  value: string | number | Date | null | undefined,
  now: number = Date.now(),
): string {
  const date = toDate(value);
  if (!date) return "—";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const deltaSeconds = Math.round((date.getTime() - now) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(deltaSeconds) >= seconds) {
      return rtf.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return rtf.format(deltaSeconds, "second");
}

/**
 * Money.
 *
 * The wire carries integer cents plus a currency code, never a float
 * (AGENT-BRIEF §3). Division by 100 happens once, here, immediately before the
 * value becomes a string — so no arithmetic anywhere in the console is ever
 * performed on a floating-point rupee amount.
 */
export function formatMoney(
  cents: number | null | undefined,
  currency = "LKR",
  options: { compact?: boolean } = {},
): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  const formatter = new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: options.compact ? 0 : 2,
    maximumFractionDigits: options.compact ? 0 : 2,
    ...(options.compact ? { notation: "compact" as const } : {}),
  });
  return formatter.format(cents / 100);
}

/** Whole numbers with thousands separators. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-LK").format(value);
}

/** A ratio in 0..1 rendered as a percentage. */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return new Intl.NumberFormat("en-LK", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
}

/** "4:59" — for the session countdown. */
export function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** "4 minutes 59 seconds" — the accessible reading of the same countdown. */
export function spellDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/** First 8 characters of a UUID, for dense table cells. Full value in `title`. */
export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length > 8 ? id.slice(0, 8) : id;
}

/** camelCase, snake_case or dotted identifiers → "Sentence case". */
export function humanise(value: string): string {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .trim();
  if (spaced.length === 0) return value;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
