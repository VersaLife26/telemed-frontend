import type { Doctor, DoctorQualification, WorkingHour } from "@/lib/consumer/api/types";
import { WEEKDAYS } from "@/lib/consumer/features/availability";

export type PracticeSummary = {
  from?: string;
  to?: string;
  timezone?: string;
  sessions?: number;
  total_appointments?: number;
  completed_count?: number;
  no_show_count?: number;
  cancelled_count?: number;
  completion_rate?: number;
  no_show_rate?: number;
  cancellation_rate?: number;
  average_rating?: number;
  review_count?: number;
  average_consultation_minutes?: number;
};

export type PeakHourCell = {
  day_of_week?: number;
  hour_of_day: number;
  bookings: number;
  completed?: number;
  no_show?: number;
  cancelled?: number;
};

export type PeakHours = {
  timezone?: string;
  by_hour_of_week?: PeakHourCell[];
  by_hour_of_day?: PeakHourCell[];
  busiest?: PeakHourCell | null;
  total_bookings?: number;
};

export type DoctorEarnings = {
  from?: string;
  to?: string;
  timezone?: string;
  currency?: string;
  gross_cents?: number;
  commission_cents?: number;
  net_cents?: number;
  paid_cents?: number;
  unpaid_cents?: number;
  payment_count?: number;
  payout_status?: string;
  payouts?: Array<{
    payout_id: string;
    amount_cents: number;
    currency?: string;
    period_start?: string;
    period_end?: string;
    sent_at?: string;
  }>;
};

export type ScheduleSettings = {
  slot_duration_minutes: number;
  buffer_minutes: number | null;
  max_per_day: number;
  timezone: string;
};

export const PRACTICE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "si", label: "Sinhala" },
  { code: "ta", label: "Tamil" },
  { code: "other", label: "Other" },
] as const;

export const CREDENTIAL_DOC_TYPES = [
  { value: "slmc_certificate", label: "SLMC certificate" },
  { value: "nic", label: "National ID" },
  { value: "degree_certificate", label: "Degree certificate" },
  { value: "specialty_board_certificate", label: "Specialty board certificate" },
  { value: "photo", label: "Identification photo" },
] as const;

export const DEFAULT_SLOT_MINUTES = 30;

/** Rates on the wire are fractions in 0..1. */
export function formatRate(fraction: number | null | undefined): string {
  if (fraction == null || !Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(1)}%`;
}

export function busiestLabel(cell: PeakHourCell | null | undefined): string {
  if (!cell) return "No bookings yet";
  const day =
    cell.day_of_week == null ? "Most days" : (WEEKDAYS[cell.day_of_week] ?? `Day ${cell.day_of_week}`);
  const hour = `${String(cell.hour_of_day).padStart(2, "0")}:00`;
  return `${day} ${hour} · ${cell.bookings} bookings`;
}

export function peakGrid(cells: PeakHourCell[] | undefined): number[][] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const cell of cells ?? []) {
    if (cell.day_of_week == null) continue;
    if (cell.day_of_week < 0 || cell.day_of_week > 6) continue;
    if (cell.hour_of_day < 0 || cell.hour_of_day > 23) continue;
    const row = grid[cell.day_of_week];
    if (!row) continue;
    row[cell.hour_of_day] = cell.bookings;
  }
  return grid;
}

export type TimeWindow = {
  start_time: string;
  end_time: string;
};

export function defaultWorkingHours(): WorkingHour[] {
  return Array.from({ length: 7 }, (_, day) => ({
    day_of_week: day,
    start_time: "09:00",
    end_time: "17:00",
    is_available: day >= 1 && day <= 5,
  }));
}

export function fillWorkingHours(hours: WorkingHour[]): WorkingHour[] {
  const byDay = new Map<number, WorkingHour[]>();
  for (const h of hours) {
    const list = byDay.get(h.day_of_week) ?? [];
    list.push(h);
    byDay.set(h.day_of_week, list);
  }

  const result: WorkingHour[] = [];
  for (const fallback of defaultWorkingHours()) {
    const dayHours = byDay.get(fallback.day_of_week);
    if (dayHours && dayHours.length > 0) {
      result.push(...dayHours);
    } else {
      result.push(fallback);
    }
  }
  return result;
}

export function groupWorkingHours(hours: WorkingHour[]): {
  windows: Record<number, TimeWindow[]>;
  available: Record<number, boolean>;
} {
  const seeded = fillWorkingHours(hours);
  const windows: Record<number, TimeWindow[]> = {};
  const available: Record<number, boolean> = {};

  for (let day = 0; day <= 6; day++) {
    windows[day] = [];
    available[day] = false;
  }

  for (const h of seeded) {
    const day = h.day_of_week;
    if (day >= 0 && day <= 6) {
      const dayWins = windows[day] ?? [];
      dayWins.push({
        start_time: h.start_time.slice(0, 5),
        end_time: h.end_time.slice(0, 5),
      });
      windows[day] = dayWins;
      if (h.is_available) {
        available[day] = true;
      }
    }
  }

  for (let day = 0; day <= 6; day++) {
    const dayWins = windows[day];
    if (!dayWins || dayWins.length === 0) {
      windows[day] = [{ start_time: "09:00", end_time: "17:00" }];
    }
  }

  return { windows, available };
}

export function flattenWorkingHours(
  windows: Record<number, TimeWindow[]>,
  available: Record<number, boolean>,
): WorkingHour[] {
  const result: WorkingHour[] = [];
  for (let day = 0; day <= 6; day++) {
    const isDayAvailable = available[day] ?? false;
    const dayWins = windows[day] ?? [];

    if (!isDayAvailable) {
      const first = dayWins[0];
      result.push({
        day_of_week: day,
        start_time: first?.start_time || "09:00",
        end_time: first?.end_time || "17:00",
        is_available: false,
      });
    } else {
      if (dayWins.length === 0) {
        result.push({
          day_of_week: day,
          start_time: "09:00",
          end_time: "17:00",
          is_available: true,
        });
      } else {
        for (const w of dayWins) {
          result.push({
            day_of_week: day,
            start_time: w.start_time,
            end_time: w.end_time,
            is_available: true,
          });
        }
      }
    }
  }
  return result;
}

export function rupeesToCents(rupees: number): number {
  return Math.round(rupees * 100);
}

export function doctorFeeCents(doctor: Pick<Doctor, "fee_cents" | "fee_lkr">): number {
  return doctor.fee_cents ?? doctor.fee_lkr ?? 0;
}

const ALLOWED_LANGUAGES = new Set(["en", "si", "ta", "other"]);

export function consultLanguages(raw?: string[]): string[] {
  const next = (raw ?? []).map((s) => s.toLowerCase()).filter((s) => ALLOWED_LANGUAGES.has(s));
  return next.length ? next : ["en"];
}

export function payoutStatusLabel(status?: string): string {
  switch (status) {
    case "no_earnings":
      return "No earnings in this window";
    case "pending":
      return "Awaiting payout";
    case "partially_paid":
      return "Partially paid";
    case "paid":
      return "Paid";
    default:
      return status || "—";
  }
}

export function summarizePracticeEarnings(earnings: DoctorEarnings) {
  return {
    currency: earnings.currency || "LKR",
    earned: earnings.net_cents ?? 0,
    paid: earnings.paid_cents ?? 0,
    pending: earnings.unpaid_cents ?? 0,
    commission: earnings.commission_cents ?? 0,
    gross: earnings.gross_cents ?? 0,
    status: payoutStatusLabel(earnings.payout_status),
  };
}

export function availabilityPutBody(input: {
  hours: WorkingHour[];
  slotMinutes: number;
  buffer: string;
  maxPerDay: number;
  holidays: Array<{ date: string; reason: string }>;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    working_hours: input.hours.map((h) => ({
      day_of_week: h.day_of_week,
      start_time: h.start_time.slice(0, 5),
      end_time: h.end_time.slice(0, 5),
      is_available: h.is_available,
    })),
    slot_duration_minutes: input.slotMinutes,
    max_per_day: input.maxPerDay,
  };
  if (input.buffer !== "") {
    const bufferMinutes = Number(input.buffer);
    if (!Number.isNaN(bufferMinutes)) body.buffer_minutes = bufferMinutes;
  }
  if (input.holidays.length > 0) {
    body.holidays = input.holidays.map((h) => ({
      date: h.date,
      reason: h.reason,
    }));
  }
  return body;
}

export function practiceProfileBody(doctor: Doctor, patch: {
  bio: string;
  feeRupees: number;
  languages: string[];
  experienceYears: number;
}): Record<string, unknown> {
  const qualifications: DoctorQualification[] = (doctor.qualifications ?? []).filter(
    (q) => q.degree && q.institution && q.year,
  );
  const body: Record<string, unknown> = {
    version: doctor.version ?? 0,
    specialty: doctor.specialty || "",
    experience_years: patch.experienceYears,
    fee_lkr: rupeesToCents(patch.feeRupees),
    languages: consultLanguages(patch.languages),
    bio: patch.bio.trim(),
    accepts_new_patients: doctor.accepts_new_patients ?? true,
    sub_specialties: doctor.sub_specialties ?? [],
    qualifications,
  };
  if (doctor.photo_url) body.photo_url = doctor.photo_url;
  return body;
}

export function documentMetadataBody(documentType: string, filename: string) {
  return {
    document_type: documentType,
    filename: filename.trim(),
  };
}
