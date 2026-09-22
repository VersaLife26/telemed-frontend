import type { Appointment, TelemedUser } from "@/lib/consumer/api/types";

/** Whole years between DOB and visit start (Asia/Colombo calendar day). */
export function ageAtVisitDate(dob: string, visitStartIso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !visitStartIso) return 0;
  const visitDay = visitStartIso.slice(0, 10);
  const [vy, vm, vd] = visitDay.split("-").map(Number);
  const [dy, dm, dd] = dob.split("-").map(Number);
  if (!vy || !dy) return 0;
  let age = vy - dy;
  if (vm < dm || (vm === dm && vd < dd)) age--;
  return age >= 0 ? age : 0;
}

export type VisitSubject = "self" | "other";

export function visitPatientFromUser(user: TelemedUser | null): {
  name: string;
  dob: string;
} {
  return {
    name: (user?.name || "").trim(),
    dob: (user?.date_of_birth || "").trim(),
  };
}

/** Name and age for the prescription pad from the appointment snapshot. */
export function prescriptionPatientFields(appt: Appointment | null): {
  name: string;
  age: string;
  locked: boolean;
} {
  if (!appt) return { name: "", age: "", locked: false };
  const name = (appt.visit_patient_name || appt.patient_name || "").trim();
  const visitStart = appt.start_at_local || appt.start_at || "";
  let age = appt.visit_patient_age;
  if ((age == null || age <= 0) && appt.visit_patient_dob && visitStart) {
    age = ageAtVisitDate(appt.visit_patient_dob, visitStart);
  }
  const locked = Boolean(name && (age != null && age > 0));
  return {
    name,
    age: age != null && age > 0 ? String(age) : "",
    locked,
  };
}
