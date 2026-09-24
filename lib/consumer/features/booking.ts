export function bookingError(slotId: string): string | null {
  if (!slotId) return "Pick a time on the doctor’s page first.";
  return null;
}

export function bookingBody(
  slotId: string,
  doctorId: string,
  symptoms: string,
  visit: {
    name: string;
    dob: string;
    relation?: string;
    sex?: string;
    weightKg?: string;
    allergies?: string;
  },
) {
  const intake: Record<string, string> = { symptoms };
  if (visit.relation?.trim()) intake.visit_relation = visit.relation.trim();
  const weight = Number.parseFloat(visit.weightKg || "");
  return {
    slot_id: slotId,
    doctor_id: doctorId,
    visit_patient_name: visit.name.trim(),
    visit_patient_dob: visit.dob.trim(),
    ...(visit.sex ? { visit_patient_sex: visit.sex } : {}),
    ...(Number.isFinite(weight) ? { visit_patient_weight_kg: Math.round(weight * 10) / 10 } : {}),
    ...(visit.allergies?.trim() ? { visit_patient_allergies: visit.allergies.trim() } : {}),
    intake,
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
