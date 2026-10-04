/** Production patient site. Doctor QR codes and share tags always point here. */
const PATIENT_APP_ORIGIN_DEFAULT = "https://patient.versalifehealth.com";

const DOCTOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDoctorId(value: string): boolean {
  return DOCTOR_ID.test(value);
}

/**
 * Origin of the patient app. The doctor app lives on a different host, so a
 * QR drawn there must not use `window.location`. Override for local dev with
 * NEXT_PUBLIC_PATIENT_APP_URL; production builds can leave it unset.
 */
export function patientAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_PATIENT_APP_URL || PATIENT_APP_ORIGIN_DEFAULT;
  return raw.trim().replace(/\/$/, "");
}

export function patientAppHost(): string {
  try {
    return new URL(patientAppOrigin()).host;
  } catch {
    return "patient.versalifehealth.com";
  }
}

/** Public profile patients open. Anonymous, and only listed while the doctor is active. */
export function doctorPublicUrl(doctorId: string, origin = patientAppOrigin()): string {
  return `${origin.replace(/\/$/, "")}/doctors/${doctorId}`;
}

/** Stable share-image address. Profile photos themselves are 5-minute signed URLs. */
export function doctorShareImageUrl(doctorId: string, origin = patientAppOrigin()): string {
  return `${origin.replace(/\/$/, "")}/doctors/${doctorId}/share-image`;
}

export function doctorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  const initials = letters.join("");
  return initials || "DR";
}

export function clipText(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** First non-empty line of a bio, clipped for a share card. */
export function doctorShareBioLine(bio?: string | null, max = 140): string {
  const line = bio
    ?.split(/\r?\n/)
    .map((part) => part.trim())
    .find(Boolean);
  return line ? clipText(line, max) : "";
}

/**
 * Text under the doctor's name when the link is pasted into WhatsApp,
 * iMessage, or the phone share sheet.
 */
export function doctorShareDescription(input: {
  specialty?: string | null;
  experienceYears?: number | null;
  feeLabel?: string | null;
  bio?: string | null;
}): string {
  const bits: string[] = [];
  const specialty = input.specialty?.trim();
  if (specialty && specialty !== "—") bits.push(specialty);
  const years = input.experienceYears ?? 0;
  if (years > 0) bits.push(`${years} ${years === 1 ? "year" : "years"} experience`);
  const fee = input.feeLabel?.trim();
  if (fee) bits.push(fee);
  const bio = doctorShareBioLine(input.bio, 120);
  const text = [bits.join(" · "), bio].filter(Boolean).join(" — ");
  return clipText(text || "Book a consultation on VersaLife Health", 180);
}
