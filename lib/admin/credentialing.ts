import type {
  Checklist,
  ChecklistItemKey,
  DoctorDocumentType,
  UpdateChecklistRequest,
} from "@/lib/admin/api/types";

/**
 * Credentialing rules the console can check for itself.
 *
 * Everything here is advisory. The authoritative decision is the admin's, and
 * the authoritative record is the application's checklist in the API. What
 * this module does is stop an admin approving a
 * doctor whose SLMC number is not even shaped like an SLMC number — a check
 * that costs nothing and catches transcription errors before they become an
 * unlicensed practitioner taking consultations.
 */

/**
 * Sri Lanka Medical Council registration number.
 *
 * The SLMC issues registration numbers as a 4–6 digit serial, optionally
 * prefixed by a single letter denoting the register (for example the
 * provisional and specialist registers). We accept that shape and nothing else.
 *
 * This is a **format** check and is labelled as one in the UI. It cannot tell
 * you the number belongs to this person or that the registration is current —
 * that is the separate "checked against the SLMC register" item, which is a
 * human looking the number up. Conflating the two is precisely the failure
 * this screen exists to prevent.
 */
const SLMC_PATTERN = /^[A-Z]?\d{4,6}$/;

export interface SlmcCheck {
  normalised: string;
  valid: boolean;
  reason: string;
}

export function checkSlmcFormat(raw: string | null | undefined): SlmcCheck {
  const normalised = (raw ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "");

  if (normalised.length === 0) {
    return { normalised, valid: false, reason: "No SLMC number was submitted." };
  }
  if (!SLMC_PATTERN.test(normalised)) {
    return {
      normalised,
      valid: false,
      reason:
        "Expected 4 to 6 digits, optionally preceded by a single register letter (for example 12345 or D12345).",
    };
  }
  return {
    normalised,
    valid: true,
    reason: "Matches the SLMC registration number format.",
  };
}

/** The docs require five or more years of practice for this platform. */
export const MINIMUM_EXPERIENCE_YEARS = 5;

export function meetsExperienceBar(years: number | null | undefined): boolean {
  return typeof years === "number" && years >= MINIMUM_EXPERIENCE_YEARS;
}

export interface ChecklistItemDefinition {
  key: ChecklistItemKey;
  label: string;
  /** What the admin is being asked to confirm, in one sentence. */
  question: string;
  /** Which uploaded document answers it. */
  evidence: string;
}

/**
 * The five checks, in the order the V2 docs §8.8 list them and in the order
 * that makes sense to work through: cheapest and most mechanical first, so a
 * doctor with a malformed SLMC number is rejected before anyone spends time
 * comparing a photograph.
 */
export const CHECKLIST_ITEMS: readonly ChecklistItemDefinition[] = [
  {
    key: "slmcFormat",
    label: "SLMC number format",
    question:
      "Is the submitted SLMC registration number in a valid format, and does it match the number printed on the certificate?",
    evidence: "SLMC certificate",
  },
  {
    key: "slmcRegistry",
    label: "SLMC register checked",
    question:
      "Have you looked this number up in the Sri Lanka Medical Council register and confirmed the registration is current and in this doctor's name?",
    evidence: "SLMC register (external lookup)",
  },
  {
    key: "experience",
    label: "Five or more years of experience",
    question:
      "Do the qualification documents support at least five years of post-registration practice?",
    evidence: "Degree certificate",
  },
  {
    key: "nicMatch",
    label: "NIC matches the name",
    question:
      "Does the name on the National Identity Card match the name on the SLMC certificate and the registration?",
    evidence: "NIC document",
  },
  {
    key: "photoClarity",
    label: "Photograph is clear and usable",
    question:
      "Is the profile photograph clear, recent, of this person, and suitable to show to patients?",
    evidence: "Profile photograph",
  },
];

/** The recorded answer for one item: true, false, or null when unanswered. */
export function itemValue(checklist: Checklist | null | undefined, key: ChecklistItemKey): boolean | null {
  return checklist?.[key]?.ok ?? null;
}

/** True when every one of the five checks has been answered yes. */
export function allChecksPassed(checklist: Checklist | null | undefined): boolean {
  return CHECKLIST_ITEMS.every((item) => itemValue(checklist, item.key) === true);
}

/** How many of the five have been answered, either way. */
export function answeredCount(checklist: Checklist | null | undefined): number {
  return CHECKLIST_ITEMS.filter((item) => itemValue(checklist, item.key) !== null).length;
}

/** Items still unanswered — named, so the UI can say which. */
export function outstandingItems(checklist: Checklist | null | undefined): ChecklistItemDefinition[] {
  return CHECKLIST_ITEMS.filter((item) => itemValue(checklist, item.key) === null);
}

/** Items explicitly answered "no". These block approval outright. */
export function failedItems(checklist: Checklist | null | undefined): ChecklistItemDefinition[] {
  return CHECKLIST_ITEMS.filter((item) => itemValue(checklist, item.key) === false);
}

/**
 * Body for PUT doctor-applications/{id}/checklist. Every field is optional on
 * the wire, so only the one being answered is sent and the others are left as
 * they are.
 */
export function checklistBody(item: ChecklistItemKey, value: boolean): Partial<UpdateChecklistRequest> {
  return { [item]: value };
}

/** A minimum that forces a sentence rather than "ok" or "no". */
export const MINIMUM_REASON_LENGTH = 20;

export function reasonProblem(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length === 0) return "A reason is required.";
  if (trimmed.length < MINIMUM_REASON_LENGTH) {
    return `Give at least ${MINIMUM_REASON_LENGTH} characters. This is the permanent record of why this decision was made.`;
  }
  return null;
}

/** Human label for a document type. */
export function documentLabel(type: DoctorDocumentType): string {
  switch (type) {
    case "slmcCertificate":
      return "SLMC certificate";
    case "nic":
      return "National Identity Card";
    case "degreeCertificate":
      return "Degree certificate";
    case "specialtyBoardCertificate":
      return "Specialty board certificate";
    case "signature":
      return "Signature";
    case "seal":
      return "Seal";
    case "other":
      return "Other document";
  }
}
