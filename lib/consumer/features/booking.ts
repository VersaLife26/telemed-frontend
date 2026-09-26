import type { BookAppointmentRequest, Sex } from "@/lib/consumer/api/types";

export function bookingError(startAt: string, symptoms: string): string | null {
  if (!startAt) return "Pick a time on the doctor’s page first.";
  if (!symptoms.trim()) return "Tell the doctor briefly what the visit is about.";
  return null;
}

/** `startAt` goes back exactly as the slot listing returned it. */
export function bookingBody(
  doctorId: string,
  startAt: string,
  symptoms: string,
  visit: {
    name: string;
    dob: string;
    relation?: string;
    sex?: Sex | "";
    weightKg?: string;
    allergies?: string;
  },
): BookAppointmentRequest {
  const weight = Number.parseFloat(visit.weightKg || "");
  return {
    doctorId,
    startAt,
    visitPatient: {
      name: visit.name.trim(),
      dateOfBirth: visit.dob.trim(),
      sex: visit.sex || null,
      weightKg: Number.isFinite(weight) ? Math.round(weight * 10) / 10 : null,
      allergies: visit.allergies?.trim() || null,
    },
    intake: {
      symptoms: symptoms.trim(),
      visitRelation: visit.relation?.trim() || null,
    },
  };
}

export function weightError(weightKg: string): string | null {
  if (!weightKg.trim()) return null;
  const n = Number.parseFloat(weightKg);
  if (!Number.isFinite(n) || n < 0.5 || n > 400) return "Weight must be between 0.5 and 400 kg.";
  return null;
}

export function bookingVisitError(
  subject: "self" | "other",
  name: string,
  dob: string,
  accountDob?: string,
): string | null {
  if (!name.trim()) {
    return subject === "other"
      ? "Enter the name of the person this visit is for."
      : "Your profile is missing a name. Update it under Profile before booking.";
  }
  const useDob = subject === "other" ? dob : accountDob || dob;
  if (!useDob || !/^\d{4}-\d{2}-\d{2}$/.test(useDob)) {
    return subject === "other"
      ? "Enter their date of birth."
      : "Add your date of birth under Profile before booking.";
  }
  if (useDob > new Date().toISOString().slice(0, 10)) {
    return "Date of birth cannot be in the future.";
  }
  return null;
}

export function paymentPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/payment`;
}

/** Intake link for a slot: the instant verbatim, plus the zone to show it in. */
export function intakePath(doctorId: string, startAt: string, timeZone: string): string {
  return `/doctors/${doctorId}/intake?${new URLSearchParams({ startAt, tz: timeZone })}`;
}
