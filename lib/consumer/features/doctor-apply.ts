import type { ProblemDetails } from "@/lib/consumer/api/errors";
import type { ConsultationLanguage, DoctorApplicationRequest, DoctorDocumentType } from "@/lib/consumer/api/types";

export const TERMS_HREF = "/legal/service-retention-agreement";

export const MAX_APPLY_DOCUMENT_BYTES = 5 * 1024 * 1024;

export const LANGUAGE_OPTIONS: ReadonlyArray<{ code: ConsultationLanguage; label: string }> = [
  { code: "si", label: "Sinhala" },
  { code: "en", label: "English" },
  { code: "ta", label: "Tamil" },
  { code: "other", label: "Other" },
];

export const APPLY_DOCUMENT_TYPES = [
  { type: "signature", label: "Clear image of your signature" },
  { type: "seal", label: "Clear image of the seal" },
  { type: "slmcCertificate", label: "Copy of most recent SLMC certificate / latest SLMC renewal" },
] as const satisfies ReadonlyArray<{ type: DoctorDocumentType; label: string }>;

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
  password: string;
  confirmPassword: string;
  phone: string;
  slmcNumber: string;
  languages: ConsultationLanguage[];
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

/** Local 07XXXXXXXX / 947XXXXXXXX / +94 77 … into E.164. */
export function normalizeSriLankanMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let d = digits;
  if (d.startsWith("94") && d.length === 11) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 10) d = d.slice(1);
  if (d.length !== 9 || d[0] !== "7") return null;
  return `+94${d}`;
}

export function doctorApplyError(form: DoctorApplyForm): string | null {
  if (!form.firstName.trim() || !form.lastName.trim()) {
    return "First name and last name are required.";
  }
  if (!form.email.trim() || !form.phone.trim()) {
    return "Email and phone are required so we can contact you after review.";
  }
  if (!normalizeSriLankanMobile(form.phone)) {
    return "Enter a Sri Lankan mobile number (07XXXXXXXX or +947XXXXXXXX).";
  }
  if (form.password.length < 8 || form.password.length > 72) {
    return "Password must be between 8 and 72 characters.";
  }
  if (form.password !== form.confirmPassword) {
    return "Password and confirmation do not match.";
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

export function doctorApplyPayload(form: DoctorApplyForm): DoctorApplicationRequest {
  const minutes = parseConsultationMinutes(form.consultationMinutes) ?? 0;
  const charge = rupeesToCents(form.feeLkr) ?? 0;
  const years = Number(form.experienceYears || "0");
  return {
    phone: normalizeSriLankanMobile(form.phone) ?? form.phone.trim(),
    email: form.email.trim(),
    password: form.password,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    displayName: null,
    slmcNumber: form.slmcNumber.trim(),
    specialtyCode: form.specialty,
    languages: form.languages,
    languageOther: form.languages.includes("other") ? form.languageOther.trim() : null,
    experienceYears: Number.isFinite(years) ? Math.floor(years) : 0,
    feeCents: charge,
    bio: null,
    pgimBoardCertified: form.pgimBoardCertified === true,
    isGeneralPractitioner: form.isGeneralPractitioner === true,
    medicalSchool: form.medicalSchool.trim(),
    qualificationsText: form.qualifications.trim(),
    availabilityNotes: formatAvailabilityNotes(
      form.availableDays,
      form.availableStart,
      form.availableEnd,
      form.availabilityExtra,
      minutes,
    ),
    practicingLocations: parseLocations(form.practicingLocations),
    termsAccepted: form.termsAccepted === true,
    bank: {
      bankName: form.bankName.trim(),
      branchName: form.bankBranch.trim(),
      accountNumber: form.accountNumber.trim(),
      accountName: form.accountName.trim(),
    },
  };
}

export function applyDocuments(form: DoctorApplyForm): { type: ApplyDocumentType; file: File }[] {
  const out: { type: ApplyDocumentType; file: File }[] = [];
  if (form.signature) out.push({ type: "signature", file: form.signature });
  if (form.seal) out.push({ type: "seal", file: form.seal });
  if (form.slmcCertificate) out.push({ type: "slmcCertificate", file: form.slmcCertificate });
  return out;
}

export function applyDocumentPath(applicationId: string, type: ApplyDocumentType): string {
  return `/doctor-applications/${applicationId}/documents/${type}`;
}

/** The problem `detail` plus every field message, so the applicant sees what to fix. */
export function readApplyError(json: unknown, fallback: string): string {
  if (!json || typeof json !== "object") return fallback;
  const problem = json as ProblemDetails;
  const detail = typeof problem.detail === "string" ? problem.detail.trim() : "";
  const parts = Object.entries(problem.errors ?? {})
    .map(([key, messages]) => [key, (messages ?? []).filter((m) => m.trim()).join(" ")] as const)
    .filter(([, message]) => message)
    .map(([key, message]) => `${key}: ${message}`);
  if (parts.length > 0) return detail ? `${detail} (${parts.join("; ")})` : parts.join("; ");
  if (detail) return detail;
  if (typeof problem.title === "string" && problem.title.trim()) return problem.title;
  return fallback;
}
