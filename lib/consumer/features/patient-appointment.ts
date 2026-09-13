import type { Appointment } from "@/lib/consumer/api/types";

const COLOMBO = "Asia/Colombo";

const PAST_STATUSES = new Set(["completed", "cancelled", "no_show", "ended"]);
const LIVE_STATUSES = new Set([
  "pending_payment",
  "unpaid",
  "confirmed",
  "scheduled",
  "waiting",
  "active",
]);

export type AppointmentAction = {
  href: string;
  label: string;
};

export function normalizeStatus(status?: string): string {
  return (status || "").trim().toLowerCase();
}

export function appointmentAction(id: string, status?: string): AppointmentAction | null {
  const s = normalizeStatus(status);
  if (s === "pending_payment" || s === "unpaid") {
    return { href: `/appointments/${id}/payment`, label: "Pay" };
  }
  if (s === "waiting" || s === "active") {
    return { href: `/appointments/${id}/call`, label: "Join" };
  }
  if (s === "confirmed" || s === "scheduled") {
    return { href: `/appointments/${id}/waiting-room`, label: "Waiting room" };
  }
  if (s === "completed" || s === "ended") {
    return { href: `/appointments/${id}/summary`, label: "Summary" };
  }
  return null;
}

export function statusLabel(status?: string): string {
  const s = normalizeStatus(status);
  switch (s) {
    case "pending_payment":
    case "unpaid":
      return "Pay now";
    case "confirmed":
      return "Confirmed";
    case "scheduled":
      return "Scheduled";
    case "waiting":
      return "In queue";
    case "active":
      return "In progress";
    case "completed":
    case "ended":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "no_show":
      return "No-show";
    default:
      return s ? s.replaceAll("_", " ") : "Unknown";
  }
}

export type BadgeTone = "amber" | "teal" | "muted" | "danger";

export function statusTone(status?: string): BadgeTone {
  const s = normalizeStatus(status);
  if (s === "pending_payment" || s === "unpaid") return "amber";
  if (s === "confirmed" || s === "scheduled" || s === "waiting" || s === "active") return "teal";
  if (s === "cancelled" || s === "no_show") return "danger";
  return "muted";
}

export function isUpcomingAppointment(appointment: Appointment, now = Date.now()): boolean {
  const s = normalizeStatus(appointment.status);
  if (PAST_STATUSES.has(s)) return false;
  if (LIVE_STATUSES.has(s)) return true;
  const start = Date.parse(appointment.start_at || appointment.start_at_local || "");
  return Number.isFinite(start) && start >= now;
}

export function pickNextAppointment(
  appointments: Appointment[],
  now = Date.now(),
): Appointment | null {
  const upcoming = appointments
    .filter((a) => isUpcomingAppointment(a, now))
    .slice()
    .sort((a, b) => {
      const aStart = Date.parse(a.start_at || a.start_at_local || "") || Number.POSITIVE_INFINITY;
      const bStart = Date.parse(b.start_at || b.start_at_local || "") || Number.POSITIVE_INFINITY;
      return aStart - bStart;
    });
  return upcoming[0] ?? null;
}

export function formatVisitClock(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: COLOMBO,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  }
  const clock = iso.match(/T(\d{2}:\d{2})/)?.[1];
  if (!clock) return "—";
  return clock;
}

export function formatVisitDate(iso?: string, now = new Date()): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: COLOMBO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const visitDay = dayKey.format(date);
  const today = dayKey.format(now);
  const tomorrow = dayKey.format(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (visitDay === today) return "Today";
  if (visitDay === tomorrow) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function colomboHour(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: COLOMBO,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
}

export function firstName(name?: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}
