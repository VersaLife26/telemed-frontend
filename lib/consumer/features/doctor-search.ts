import type { Specialty } from "@/lib/consumer/api/types";
import { rupeesToCents } from "@/lib/consumer/features/doctor-apply";

export type DoctorListFilters = {
  q?: string;
  specialty?: string;
  /** Consultation fee lower bound in LKR (page URL / form value). */
  minFee?: string;
  /** Consultation fee upper bound in LKR (page URL / form value). */
  maxFee?: string;
};

/**
 * Builds the query string for GET /api/v1/doctors.
 * Page filters use LKR for minFee / maxFee; the API expects integer cents.
 */
export function buildDoctorsApiQuery(filters: DoctorListFilters, pageSize = 30): string {
  const qs = new URLSearchParams({ pageSize: String(pageSize), sort: "experience" });

  const q = filters.q?.trim();
  if (q) qs.set("q", q);

  const specialty = filters.specialty?.trim();
  if (specialty) qs.set("specialty", specialty);

  const minCents = filters.minFee?.trim() ? rupeesToCents(filters.minFee.trim()) : null;
  if (minCents != null) qs.set("minFee", String(minCents));

  const maxCents = filters.maxFee?.trim() ? rupeesToCents(filters.maxFee.trim()) : null;
  if (maxCents != null) qs.set("maxFee", String(maxCents));

  return qs.toString();
}

/** Display name from GET /specialties, falling back to the code itself. */
export function specialtyLabel(code?: string | null, specialties: Specialty[] = []): string {
  if (!code) return "—";
  const found = specialties.find((s) => s.code === code);
  if (found) return found.nameEn;
  return code.replaceAll("_", " ");
}

export function hasActiveDoctorFilters(filters: DoctorListFilters): boolean {
  return Boolean(
    filters.q?.trim() ||
      filters.specialty?.trim() ||
      filters.minFee?.trim() ||
      filters.maxFee?.trim(),
  );
}
