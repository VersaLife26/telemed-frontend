import { SURFACE } from "@/lib/consumer/surface";

const HEADER = "CF-IPCountry";

/**
 * Country Cloudflare attached to this request, forwarded only by the patient app.
 * The doctor and admin apps share these routes but do not register patients, so
 * they leave the header off and the API treats the account as international.
 */
export function countryHeaders(req: Request): Record<string, string> {
  if (SURFACE !== "patient") return {};
  const raw = req.headers.get(HEADER);
  if (!raw) return {};
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return {};
  return { [HEADER]: code };
}
