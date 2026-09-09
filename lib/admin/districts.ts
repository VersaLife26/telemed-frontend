/**
 * The 25 administrative districts of Sri Lanka, grouped by province.
 *
 * The dashboard's district breakdown renders every district the backend
 * reports plus the ones it does not, at zero — an admin looking at coverage
 * needs to see that Mullaitivu has no bookings, and a chart built only from
 * returned rows silently hides exactly that.
 */

export interface District {
  /** Stable key. Matches `appointments_projection.district`. */
  code: string;
  name: string;
  province: string;
}

export const DISTRICTS: readonly District[] = [
  { code: "colombo", name: "Colombo", province: "Western" },
  { code: "gampaha", name: "Gampaha", province: "Western" },
  { code: "kalutara", name: "Kalutara", province: "Western" },
  { code: "kandy", name: "Kandy", province: "Central" },
  { code: "matale", name: "Matale", province: "Central" },
  { code: "nuwara_eliya", name: "Nuwara Eliya", province: "Central" },
  { code: "galle", name: "Galle", province: "Southern" },
  { code: "matara", name: "Matara", province: "Southern" },
  { code: "hambantota", name: "Hambantota", province: "Southern" },
  { code: "jaffna", name: "Jaffna", province: "Northern" },
  { code: "kilinochchi", name: "Kilinochchi", province: "Northern" },
  { code: "mannar", name: "Mannar", province: "Northern" },
  { code: "vavuniya", name: "Vavuniya", province: "Northern" },
  { code: "mullaitivu", name: "Mullaitivu", province: "Northern" },
  { code: "batticaloa", name: "Batticaloa", province: "Eastern" },
  { code: "ampara", name: "Ampara", province: "Eastern" },
  { code: "trincomalee", name: "Trincomalee", province: "Eastern" },
  { code: "kurunegala", name: "Kurunegala", province: "North Western" },
  { code: "puttalam", name: "Puttalam", province: "North Western" },
  { code: "anuradhapura", name: "Anuradhapura", province: "North Central" },
  { code: "polonnaruwa", name: "Polonnaruwa", province: "North Central" },
  { code: "badulla", name: "Badulla", province: "Uva" },
  { code: "monaragala", name: "Monaragala", province: "Uva" },
  { code: "ratnapura", name: "Ratnapura", province: "Sabaragamuwa" },
  { code: "kegalle", name: "Kegalle", province: "Sabaragamuwa" },
];

const BY_CODE = new Map(DISTRICTS.map((d) => [d.code, d]));

/**
 * Resolves whatever the backend sent to a known district. The projection
 * column is free text fed from an event payload, so tolerate "Colombo",
 * "colombo" and "COLOMBO" alike rather than dropping the row.
 */
export function districtFor(raw: string | null | undefined): District | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return BY_CODE.get(key) ?? null;
}

export function districtName(raw: string | null | undefined): string {
  return districtFor(raw)?.name ?? (raw && raw.trim().length > 0 ? raw : "Unknown");
}

export const PROVINCES: readonly string[] = Array.from(
  new Set(DISTRICTS.map((d) => d.province)),
);
