export const TERMS_HREF = "/legal/service-retention-agreement";

export const MAX_APPLY_DOCUMENT_BYTES = 5 * 1024 * 1024;

export const SPECIALTIES = [
  { code: "general_practice", label: "General Practitioner" },
  { code: "pediatrics", label: "Pediatrics" },
  { code: "obstetrics_gynae", label: "Obstetrics & Gynaecology" },
  { code: "cardiology", label: "Cardiology" },
  { code: "dermatology", label: "Dermatology" },
  { code: "endocrinology", label: "Endocrinology & Diabetes" },
  { code: "ent", label: "ENT (Ear, Nose & Throat)" },
  { code: "psychiatry", label: "Psychiatry" },
  { code: "psychology", label: "Psychology & Counselling" },
  { code: "orthopedics", label: "Orthopedics" },
  { code: "ophthalmology", label: "Ophthalmology (Eye Care)" },
  { code: "neurology", label: "Neurology" },
  { code: "gastroenterology", label: "Gastroenterology" },
  { code: "nephrology", label: "Nephrology" },
  { code: "urology", label: "Urology" },
  { code: "pulmonology", label: "Pulmonology (Chest/Lung)" },
  { code: "general_surgery", label: "General Surgery" },
  { code: "dental", label: "Dental" },
  { code: "nutrition", label: "Nutrition & Dietetics" },
] as const;

export const LANGUAGE_OPTIONS = [
  { code: "si", label: "Sinhala" },
  { code: "en", label: "English" },
  { code: "ta", label: "Tamil" },
  { code: "other", label: "Other" },
] as const;

export const APPLY_DOCUMENT_TYPES = [
  { type: "signature", label: "Clear image of your signature" },
  { type: "seal", label: "Clear image of the seal" },
  { type: "slmc_certificate", label: "Copy of most recent SLMC certificate / latest SLMC renewal" },
] as const;

export type ApplyDocumentType = (typeof APPLY_DOCUMENT_TYPES)[number]["type"];

export const WEEKDAYS = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
] as const;

export type DoctorApplyForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  slmcNumber: string;
  languages: string[];
  languageOther: string;
  pgimBoardCertified: boolean | null;
  medicalSchool: string;
  qualifications: string;
  /** Minutes each consultation should last (slot length). */
  consultationMinutes: string;
  feeLkr: string;
  availableDays: number[];
  availableStart: string;
  availableEnd: string;
  availabilityExtra: string;
  isGeneralPractitioner: boolean | null;
  specialty: string;
  experienceYears: string;
  practicingLocations: string;
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  accountName: string;
  termsAccepted: boolean | null;
  signature: File | null;
  seal: File | null;
  slmcCertificate: File | null;
};

export function rupeesToCents(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function parseLocations(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseConsultationMinutes(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 5 || n > 240) return null;
  return n;
}

export function formatAvailabilityNotes(
  days: number[],
  start: string,
  end: string,
  extra: string,
  consultationMinutes?: number | null,
): string {
  const labels = WEEKDAYS.filter((d) => days.includes(d.day)).map((d) => d.label.slice(0, 3));
  const parts: string[] = [];
  if (consultationMinutes != null && consultationMinutes > 0) {
    parts.push(`${consultationMinutes} min per consultation`);
  }
  if (labels.length > 0 && start && end) {
    parts.push(`${labels.join(", ")} ${start}–${end}`);
  } else if (labels.length > 0) {
    parts.push(labels.join(", "));
  } else if (start && end) {
    parts.push(`${start}–${end}`);
  }
  const extraTrim = extra.trim();
  if (extraTrim) parts.push(extraTrim);
  return parts.join(". ");
}

function fileTooLarge(file: File | null): boolean {
  return !!file && file.size > MAX_APPLY_DOCUMENT_BYTES;
}

export function doctorApplyError(form: DoctorApplyForm): string | null {
  if (!form.firstName.trim() || !form.lastName.trim()) {
    return "First name and last name are required.";
  }
  if (!form.email.trim() || !form.phone.trim()) {
    return "Email and phone are required so we can contact you after review.";
  }
  if (!form.slmcNumber.trim()) {
    return "Board registration number (SLMC) is required.";
  }
  if (form.languages.length === 0) {
    return "Select at least one language you consult in.";
  }
  if (form.languages.includes("other") && !form.languageOther.trim()) {
    return "Specify the other language you consult in.";
  }
  if (form.pgimBoardCertified === null) {
    return "Say whether you are PGIM board certified.";
  }
  if (!form.medicalSchool.trim()) {
    return "Medical school is required.";
  }
  if (!form.qualifications.trim()) {
    return "Qualifications are required.";
  }
  if (parseConsultationMinutes(form.consultationMinutes) === null) {
    return "Enter how long each consultation takes, in minutes (5–240).";
  }
  if (rupeesToCents(form.feeLkr) === null) {
    return "Enter how much you like to charge per consultation, in LKR.";
  }
  if (
    !formatAvailabilityNotes(
      form.availableDays,
      form.availableStart,
      form.availableEnd,
      form.availabilityExtra,
      parseConsultationMinutes(form.consultationMinutes),
    )
  ) {
    return "Tell us when you are available for consultation.";
  }
  if (form.isGeneralPractitioner === null) {
    return "Say whether you are a general practitioner.";
  }
  if (!form.specialty) {
    return "Select a specialty.";
  }
  const years = Number(form.experienceYears || "0");
  if (!Number.isFinite(years) || years < 0 || years > 70) {
    return "Experience years must be between 0 and 70.";
  }
  if (parseLocations(form.practicingLocations).length === 0) {
    return "Add at least one practicing location or hospital.";
  }
  if (
    !form.bankName.trim() ||
    !form.bankBranch.trim() ||
    !form.accountNumber.trim() ||
    !form.accountName.trim()
  ) {
    return "Bank name, branch, account number and account name are required.";
  }
  if (!form.signature || !form.seal || !form.slmcCertificate) {
    return "Upload your signature, seal, and most recent SLMC certificate.";
  }
  if (fileTooLarge(form.signature) || fileTooLarge(form.seal) || fileTooLarge(form.slmcCertificate)) {
    return "Each document must be 5 MB or smaller.";
  }
  if (form.termsAccepted !== true) {
    return "You must accept the VersaLife service retention agreement to apply.";
  }
  return null;
}

export function doctorApplyPayload(form: DoctorApplyForm) {
  const minutes = parseConsultationMinutes(form.consultationMinutes) ?? 0;
  const charge = rupeesToCents(form.feeLkr) ?? 0;
  const years = Number(form.experienceYears || "0");
  return {
    first_name: form.firstName.trim(),
    last_name: form.lastName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    slmc_number: form.slmcNumber.trim(),
    specialty: form.specialty,
    languages: form.languages,
    language_other: form.languages.includes("other") ? form.languageOther.trim() : "",
    pgim_board_certified: form.pgimBoardCertified === true,
    medical_school: form.medicalSchool.trim(),
    qualifications: form.qualifications.trim(),
    experience_years: Number.isFinite(years) ? Math.floor(years) : 0,
    // Apply API still requires required_fee_lkr; doctors now declare one list price.
    required_fee_lkr: charge,
    fee_lkr: charge,
    availability_notes: formatAvailabilityNotes(
      form.availableDays,
      form.availableStart,
      form.availableEnd,
      form.availabilityExtra,
      minutes,
    ),
    is_general_practitioner: form.isGeneralPractitioner === true,
    practicing_locations: parseLocations(form.practicingLocations),
    terms_accepted: form.termsAccepted === true,
    bank: {
      bank_name: form.bankName.trim(),
      branch_name: form.bankBranch.trim(),
      account_number: form.accountNumber.trim(),
      account_name: form.accountName.trim(),
    },
  };
}

export function applyDocuments(form: DoctorApplyForm): { type: ApplyDocumentType; file: File }[] {
  const out: { type: ApplyDocumentType; file: File }[] = [];
  if (form.signature) out.push({ type: "signature", file: form.signature });
  if (form.seal) out.push({ type: "seal", file: form.seal });
  if (form.slmcCertificate) out.push({ type: "slmc_certificate", file: form.slmcCertificate });
  return out;
}

export function applyDocumentPath(applicationId: string): string {
  return `/doctors/applications/${applicationId}/documents`;
}

export function readApplyError(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && "message" in json) {
    const message = (json as { message?: string }).message;
    if (message) return message;
  }
  return fallback;
}
