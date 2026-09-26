import type {
  ConsultationLanguage,
  DoctorDocumentType,
  DoctorProfile,
  DoctorQualification,
  PeakHour,
  Schedule,
  UpdateScheduleRequest,
  WorkingHour,
} from "@/lib/consumer/api/types";
import { WEEKDAYS, clockToMinute, minuteToClock } from "@/lib/consumer/features/availability";

export const PRACTICE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "si", label: "Sinhala" },
  { code: "ta", label: "Tamil" },
  { code: "other", label: "Other" },
] as const;

export const CREDENTIAL_DOC_TYPES: ReadonlyArray<{ value: DoctorDocumentType; label: string }> = [
  { value: "slmcCertificate", label: "SLMC certificate" },
  { value: "nic", label: "National ID" },
  { value: "degreeCertificate", label: "Degree certificate" },
  { value: "specialtyBoardCertificate", label: "Specialty board certificate" },
  { value: "other", label: "Other" },
];

export const DEFAULT_SLOT_MINUTES = 30;
const DEFAULT_ADVANCE_DAYS = 30;
const DEFAULT_TIMEZONE = "Asia/Colombo";

/** Rates on the wire are fractions in 0..1. */
export function formatRate(fraction: number | null | undefined): string {
  if (fraction == null || !Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(1)}%`;
}

export function cancellationRate(summary: { consultations: number; cancelled: number } | null): number | null {
  if (!summary) return null;
  return summary.consultations > 0 ? summary.cancelled / summary.consultations : 0;
}

export function busiestCell(cells: PeakHour[] | null | undefined): PeakHour | null {
  let best: PeakHour | null = null;
  for (const cell of cells ?? []) {
    if (cell.count > 0 && (!best || cell.count > best.count)) best = cell;
  }
  return best;
}

export function busiestLabel(cell: PeakHour | null | undefined): string {
  if (!cell) return "No bookings yet";
  const day = WEEKDAYS[cell.dayOfWeek] ?? `Day ${cell.dayOfWeek}`;
  const hour = `${String(cell.hour).padStart(2, "0")}:00`;
  return `${day} ${hour} · ${cell.count} bookings`;
}

/** Seven rows (Sunday first) of 24 hourly booking counts. */
export function peakGrid(cells: PeakHour[] | null | undefined): number[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const cell of cells ?? []) {
    if (cell.dayOfWeek < 0 || cell.dayOfWeek > 6) continue;
    if (cell.hour < 0 || cell.hour > 23) continue;
    const row = grid[cell.dayOfWeek];
    if (row) row[cell.hour] = cell.count;
  }
  return grid;
}

/** One editable shift, as `<input type="time">` values. */
export type TimeWindow = {
  start: string;
  end: string;
};

const DEFAULT_WINDOW: TimeWindow = { start: "09:00", end: "17:00" };

/**
 * Editor state from stored working hours. A day with no rows is not a working
 * day; it still gets a default window so switching it on has something to edit.
 */
export function groupWorkingHours(hours: WorkingHour[]): {
  windows: Record<number, TimeWindow[]>;
  available: Record<number, boolean>;
} {
  const windows: Record<number, TimeWindow[]> = {};
  const available: Record<number, boolean> = {};
  for (let day = 0; day <= 6; day++) {
    windows[day] = [];
    available[day] = false;
  }

  const sorted = [...hours].sort((a, b) => a.startMinute - b.startMinute);
  for (const h of sorted) {
    if (h.dayOfWeek < 0 || h.dayOfWeek > 6) continue;
    windows[h.dayOfWeek]?.push({ start: minuteToClock(h.startMinute), end: minuteToClock(h.endMinute) });
    available[h.dayOfWeek] = true;
  }

  for (let day = 0; day <= 6; day++) {
    if (!windows[day]?.length) windows[day] = [{ ...DEFAULT_WINDOW }];
  }
  return { windows, available };
}

/** Working-hour rows for the days that are switched on; other days send nothing. */
export function flattenWorkingHours(
  windows: Record<number, TimeWindow[]>,
  available: Record<number, boolean>,
): WorkingHour[] {
  const result: WorkingHour[] = [];
  for (let day = 0; day <= 6; day++) {
    if (!available[day]) continue;
    for (const w of windows[day] ?? []) {
      result.push({ dayOfWeek: day, startMinute: clockToMinute(w.start), endMinute: clockToMinute(w.end) });
    }
  }
  return result;
}

export function schedulePutBody(
  current: Schedule | null,
  input: { hours: WorkingHour[]; slotMinutes: number; bufferMinutes: number; maxPerDay: number },
): UpdateScheduleRequest {
  return {
    slotDurationMinutes: input.slotMinutes,
    bufferMinutes: input.bufferMinutes,
    maxPerDay: input.maxPerDay,
    advanceDays: current?.advanceDays ?? DEFAULT_ADVANCE_DAYS,
    timezone: current?.timezone || DEFAULT_TIMEZONE,
    workingHours: input.hours,
  };
}

export function rupeesToCents(rupees: number): number {
  return Math.round(rupees * 100);
}

export function doctorFeeCents(doctor: Pick<DoctorProfile, "feeCents">): number {
  return doctor.feeCents ?? 0;
}

const ALLOWED_LANGUAGES = new Set<string>(["en", "si", "ta", "other"]);

export function consultLanguages(raw?: string[]): ConsultationLanguage[] {
  const next = (raw ?? [])
    .map((s) => s.toLowerCase())
    .filter((s): s is ConsultationLanguage => ALLOWED_LANGUAGES.has(s));
  return next.length ? next : ["en"];
}

export function practiceProfileBody(
  doctor: DoctorProfile,
  patch: { bio: string; feeRupees: number; languages: string[]; experienceYears: number },
) {
  const qualifications: DoctorQualification[] = (doctor.qualifications ?? []).filter(
    (q) => q.degree && q.institution,
  );
  const languages = consultLanguages(patch.languages);
  return {
    displayName: doctor.displayName || "",
    bio: patch.bio.trim(),
    subSpecialties: doctor.subSpecialties ?? [],
    languages,
    languageOther: languages.includes("other") ? (doctor.languageOther ?? null) : null,
    qualifications,
    experienceYears: patch.experienceYears,
    feeCents: rupeesToCents(patch.feeRupees),
    acceptsNewPatients: doctor.acceptsNewPatients ?? true,
    version: doctor.version ?? 0,
  };
}

export const MAX_CREDENTIAL_DOCUMENT_BYTES = 5 * 1024 * 1024;

const CREDENTIAL_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

export function credentialDocumentError(file: { type: string; size: number } | null): string | null {
  if (!file) return "Choose a file to upload.";
  if (!CREDENTIAL_DOCUMENT_TYPES.has(file.type)) return "Upload a PDF, JPEG or PNG file.";
  if (file.size > MAX_CREDENTIAL_DOCUMENT_BYTES) return "Each document must be 5 MB or smaller.";
  return null;
}

/**
 * Signed file links arrive as `/api/v1/files/{token}`. The browser reaches the
 * API only through the BFF, which already prefixes `/api/v1`.
 */
export function apiFileSrc(url?: string | null): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/api/proxy/")) return raw;
  const path = raw.startsWith("/api/v1/") ? raw.slice("/api/v1".length) : raw.startsWith("/") ? raw : `/${raw}`;
  return `/api/proxy${path}`;
}
