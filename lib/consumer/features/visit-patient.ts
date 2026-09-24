import type { Appointment, Sex, TelemedUser } from "@/lib/consumer/api/types";

/** Whole years between DOB and visit start (Asia/Colombo calendar day). */
export function ageAtVisitDate(dob: string, visitStartIso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !visitStartIso) return 0;
  const visitDay = visitStartIso.slice(0, 10);
  const [vy, vm, vd] = visitDay.split("-").map(Number);
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
    name: (user?.name || "").trim(),
    dob: (user?.date_of_birth || "").trim(),
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
    sex: appt.visit_patient_sex || "",
    weightKg: appt.visit_patient_weight_kg ? String(appt.visit_patient_weight_kg) : "",
    allergies: (appt.visit_patient_allergies || "").trim(),
    locked,
  };
}
