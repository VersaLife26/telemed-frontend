import type { ClinicalNote, ClinicalNoteDiagnosis, DiagnosisInput, Icd10Code } from "@/lib/consumer/api/types";

export const SOAP_SECTIONS = [
  { key: "subjective", label: "Subjective", hint: "What the patient reports" },
  { key: "objective", label: "Objective", hint: "Exam findings, vitals, labs" },
  { key: "assessment", label: "Assessment", hint: "Working diagnosis" },
  { key: "plan", label: "Plan", hint: "Treatment and follow-up" },
] as const;

export type SoapSectionKey = (typeof SOAP_SECTIONS)[number]["key"];
export type SoapDraft = Record<SoapSectionKey, string>;

export const MAX_DIAGNOSES = 10;

export function emptyDraft(): SoapDraft {
  return { subjective: "", objective: "", assessment: "", plan: "" };
}

export function applyNote(note: ClinicalNote): SoapDraft {
  return {
    subjective: note.subjective || "",
    objective: note.objective || "",
    assessment: note.assessment || "",
    plan: note.plan || "",
  };
}

export function hasSoapContent(draft: SoapDraft, diagnoses: ClinicalNoteDiagnosis[]): boolean {
  return SOAP_SECTIONS.some((s) => draft[s.key].trim()) || diagnoses.length > 0;
}

export function shouldAutosave(status: ClinicalNote["status"]): boolean {
  return status !== "finalised";
}

export function canSearchReference(query: string): boolean {
  return query.trim().length >= 2;
}

export function addDiagnosis(
  current: ClinicalNoteDiagnosis[],
  code: Icd10Code,
): ClinicalNoteDiagnosis[] {
  if (current.some((d) => d.code === code.code) || current.length >= MAX_DIAGNOSES) return current;
  return [
    ...current,
    { code: code.code, display: code.display, isPrimary: current.length === 0 },
  ];
}

export function removeDiagnosis(current: ClinicalNoteDiagnosis[], code: string): ClinicalNoteDiagnosis[] {
  const next = current.filter((d) => d.code !== code);
  if (next.length && !next.some((d) => d.isPrimary)) {
    return next.map((d, i) => ({ ...d, isPrimary: i === 0 }));
  }
  return next;
}

export function setPrimary(current: ClinicalNoteDiagnosis[], code: string): ClinicalNoteDiagnosis[] {
  return current.map((d) => ({ ...d, isPrimary: d.code === code }));
}

export function clinicalNotePath(appointmentId: string, action?: "finalise" | "amend" | "revisions"): string {
  const base = `/appointments/${appointmentId}/clinical-note`;
  return action ? `${base}/${action}` : base;
}

function diagnosisInputs(diagnoses: ClinicalNoteDiagnosis[]): DiagnosisInput[] {
  return diagnoses.map((d) => ({ code: d.code, isPrimary: d.isPrimary }));
}

/** `version` is null until the note exists; the first save creates it. */
export function savePayload(draft: SoapDraft, diagnoses: ClinicalNoteDiagnosis[], version: number | null) {
  return {
    ...draft,
    diagnoses: diagnosisInputs(diagnoses),
    version,
  };
}

export function finalisePayload(version: number | null) {
  return { version };
}

export function amendPayload(
  draft: SoapDraft,
  diagnoses: ClinicalNoteDiagnosis[],
  reason: string,
  version: number | null,
) {
  return {
    reason: reason.trim(),
    ...draft,
    diagnoses: diagnosisInputs(diagnoses),
    version,
  };
}

export function amendReasonError(reason: string): string | null {
  if (reason.trim().length < 3) return "Amendment reason must be at least 3 characters.";
  return null;
}

export const AMEND_NO_CHANGE =
  "Change at least one section or diagnosis before saving. A reason alone does not create a revision.";

export function soapUnchanged(
  a: SoapDraft,
  b: SoapDraft,
  dxA: ClinicalNoteDiagnosis[],
  dxB: ClinicalNoteDiagnosis[],
): boolean {
  if (SOAP_SECTIONS.some((s) => a[s.key] !== b[s.key])) return false;
  if (dxA.length !== dxB.length) return false;
  return dxA.every(
    (d, i) => d.code === dxB[i]?.code && d.isPrimary === dxB[i]?.isPrimary,
  );
}
