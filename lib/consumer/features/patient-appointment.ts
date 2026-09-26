import type { Appointment, Doctor } from "@/lib/consumer/api/types";

const COLOMBO = "Asia/Colombo";

const PAST_STATUSES = new Set(["completed", "cancelled", "noShow"]);

export type AppointmentAction = {
  href: string;
  label: string;
};

export function appointmentAction(id: string, status?: string): AppointmentAction | null {
  if (status === "pendingPayment") {
    return { href: `/appointments/${id}/payment`, label: "Pay" };
  }
  if (status === "confirmed") {
    return { href: `/appointments/${id}/call`, label: "Join" };
  }
  if (status === "completed") {
    return { href: `/appointments/${id}/summary`, label: "Summary" };
  }
  return null;
}

export function statusLabel(status?: string): string {
  switch (status) {
    case "pendingPayment":
      return "Pay now";
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "noShow":
      return "No-show";
    default:
      return status || "Unknown";
  }
}

export type BadgeTone = "amber" | "teal" | "muted" | "danger";

export function statusTone(status?: string): BadgeTone {
  if (status === "pendingPayment") return "amber";
  if (status === "confirmed") return "teal";
  if (status === "cancelled" || status === "noShow") return "danger";
  return "muted";
}

export function isUpcomingAppointment(appointment: Pick<Appointment, "status">): boolean {
  return !PAST_STATUSES.has(appointment.status);
}

export function pickNextAppointment(appointments: Appointment[]): Appointment | null {
  const upcoming = appointments
    .filter((a) => isUpcomingAppointment(a))
    .slice()
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  return upcoming[0] ?? null;
}

/** Wall-clock time of an instant, in the doctor's zone when the caller knows it. */
export function formatVisitClock(iso?: string, timeZone = COLOMBO): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatVisitDate(iso?: string, now = new Date(), timeZone = COLOMBO): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
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
    timeZone,
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

export function uniqueDoctorIds(appointments: Pick<Appointment, "doctorId">[]): string[] {
  return [...new Set(appointments.map((a) => a.doctorId).filter(Boolean))];
}

/** Doctor's name for a patient-facing visit row. Appointments carry only the doctor id. */
export function appointmentDoctorName(
  appointment: Partial<Pick<Appointment, "id" | "doctorId">>,
  names: Record<string, string> = {},
): string {
  return (appointment.doctorId ? names[appointment.doctorId]?.trim() : "") || "Consultation";
}

export async function resolveDoctorNames(
  appointments: Pick<Appointment, "doctorId">[],
  fetchDoctor: (id: string) => Promise<Pick<Doctor, "displayName">>,
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    uniqueDoctorIds(appointments).map(async (id) => {
      try {
        const doctor = await fetchDoctor(id);
        return [id, doctor.displayName?.trim() || ""] as const;
      } catch {
        return [id, ""] as const;
      }
    }),
  );
  return Object.fromEntries(entries.filter(([, name]) => name));
}
