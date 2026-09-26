import { SURFACE } from "@/lib/consumer/surface";

// .trim() before anything else. This value arrives from a CI variable or a
// Cloudflare build-variable field, and a leading space pasted into one of those
// survives into the bundle as " https://api...", and the browser resolves the
// signalling hub URL (consult.ts hubUrlFor) against it, which fails on a
// string that starts with a space.
export const API_BASE_URL = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080"
)
  .trim()
  .replace(/\/$/, "");

// Cookie names are per surface, and must stay that way. patient-web and
// doctor-web run on sibling subdomains; a shared cookie name would let a
// doctor session be presented to the patient app and vice versa.
export const ACCESS_COOKIE = `telemed_${SURFACE}_access`;
export const REFRESH_COOKIE = `telemed_${SURFACE}_refresh`;

export const GOOGLE_CLIENT_ID = (
  process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""
).trim();

/**
 * Whether this build serves the developer test surface at /test.
 *
 * NEXT_PUBLIC_ because the page is a client component and the decision has to
 * survive into the bundle. That also means it is public and cannot be a
 * security control: the surface it reaches is the API's /api/v1/test/*, and
 * what actually keeps that unreachable is the API's own per-feature switches
 * plus TEST_SECRET below. This flag only decides whether the page is worth
 * rendering.
 *
 * Defaults to on, so a developer who has configured nothing still gets it.
 */
export const TEST_MODE =
  (process.env.NEXT_PUBLIC_TELEMED_TEST_MODE ?? "true").trim().toLowerCase() !== "false";

/**
 * Shared secret for the API's /test/* endpoints, sent as X-Test-Secret by the
 * BFF proxy on test/ paths only. Server-only: never NEXT_PUBLIC_, so it stays
 * out of the browser bundle. Leave it unset anywhere the test endpoints must
 * not be reachable through this site.
 */
export const TEST_SECRET = (process.env.TEST_SECRET || "").trim();
