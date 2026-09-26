import type { Appointment, Sex, TelemedUser } from "@/lib/consumer/api/types";

const visitDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Colombo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Whole years between DOB and visit start (Asia/Colombo calendar day). */
export function ageAtVisitDate(dob: string, visitStartIso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !visitStartIso) return 0;
  const start = new Date(visitStartIso);
  if (Number.isNaN(start.getTime())) return 0;
  const [vy, vm, vd] = visitDayFormat.format(start).split("-").map(Number);
  const [dy, dm, dd] = dob.split("-").map(Number);
  if (vy == null || vm == null || vd == null || dy == null || dm == null || dd == null) return 0;
  let age = vy - dy;
  if (vm < dm || (vm === dm && vd < dd)) age--;
  return age >= 0 ? age : 0;
}

export type VisitSubject = "self" | "other";

export function visitPatientFromUser(user: TelemedUser | null): {
  name: string;
  dob: string;
  sex: Sex | "";
  allergies: string;
} {
  return {
    name: (user?.fullName || "").trim(),
    dob: (user?.dateOfBirth || "").trim(),
    sex: user?.sex || "",
    allergies: (user?.allergies || "").trim(),
  };
}

export type PrescriptionPatient = {
  name: string;
  age: string;
  sex: Sex | "";
  weightKg: string;
  allergies: string;
  locked: boolean;
};

/** Patient block for the prescription pad, from the booking snapshot. */
export function prescriptionPatientFields(appt: Appointment | null): PrescriptionPatient {
  if (!appt) return { name: "", age: "", sex: "", weightKg: "", allergies: "", locked: false };
  const visit = appt.visitPatient;
  const name = visit.name.trim();
  const age = ageAtVisitDate(visit.dateOfBirth, appt.startAt);
  return {
    name,
    age: age > 0 ? String(age) : "",
    sex: visit.sex || "",
    weightKg: visit.weightKg ? String(visit.weightKg) : "",
    allergies: (visit.allergies || "").trim(),
    locked: Boolean(name && age > 0),
  };
}
