import type { ClinicalNote } from "@/lib/consumer/api/types";

export const SUMMARY_POLL_MAX_ATTEMPTS = 30;

export function noteVisibleToPatient(note: ClinicalNote | null): note is ClinicalNote {
  return Boolean(note && note.status === "finalised");
}

export function shouldStopPolling(opts: {
  noteFinalised: boolean;
  haveRx: boolean;
  attempts: number;
  maxAttempts?: number;
}): boolean {
  const max = opts.maxAttempts ?? SUMMARY_POLL_MAX_ATTEMPTS;
  return opts.attempts > max || (opts.noteFinalised && opts.haveRx);
}

export function prescriptionLookupPath(appointmentId: string): string {
  return `/prescriptions?appointment_id=${encodeURIComponent(appointmentId)}`;
}

export function clinicalNotePath(appointmentId: string): string {
  return `/clinical-notes/${appointmentId}`;
}
