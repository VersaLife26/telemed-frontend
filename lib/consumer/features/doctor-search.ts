import { SPECIALTIES, rupeesToCents } from "@/lib/consumer/features/doctor-apply";

export type DoctorListFilters = {
  q?: string;
  specialty?: string;
  /** Consultation fee lower bound in LKR (page URL / form value). */
  min_fee?: string;
  /** Consultation fee upper bound in LKR (page URL / form value). */
  max_fee?: string;
};

/**
 * Builds the query string for GET /api/v1/doctors.
 * Page filters use LKR for min_fee / max_fee; the API expects integer cents.
 */
export function buildDoctorsApiQuery(filters: DoctorListFilters): string {
  const qs = new URLSearchParams({ per_page: "30", sort: "rating" });

  const q = filters.q?.trim();
  if (q) qs.set("q", q);

  const specialty = filters.specialty?.trim();
  if (specialty && SPECIALTIES.some((s) => s.code === specialty)) {
    qs.set("specialty", specialty);
  }

  const minCents = filters.min_fee?.trim() ? rupeesToCents(filters.min_fee.trim()) : null;
  if (minCents != null) qs.set("min_fee", String(minCents));

  const maxCents = filters.max_fee?.trim() ? rupeesToCents(filters.max_fee.trim()) : null;
  if (maxCents != null) qs.set("max_fee", String(maxCents));

  return qs.toString();
}

export function specialtyLabel(code?: string | null): string {
  if (!code) return "—";
  const found = SPECIALTIES.find((s) => s.code === code);
  if (found) return found.label;
  return code.replaceAll("_", " ");
}

export function hasActiveDoctorFilters(filters: DoctorListFilters): boolean {
  return Boolean(
    filters.q?.trim() ||
      filters.specialty?.trim() ||
      filters.min_fee?.trim() ||
      filters.max_fee?.trim(),
  );
}
