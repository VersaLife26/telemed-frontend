import { SURFACE } from "@/lib/consumer/surface";

export const API_BASE_URL =
  (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080").replace(
    /\/$/,
    "",
  );

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
 * security control: the surface it reaches is the backend's /api/v1/test/*,
 * and what actually keeps that unreachable in production is the backend's own
 * TELEMED_TEST_MODE, which a production ENV overrides regardless. This flag
 * only decides whether the page is worth rendering.
 *
 * Defaults to on, matching the backend, so a developer who has configured
 * nothing still gets it.
 */
export const TEST_MODE =
  (process.env.NEXT_PUBLIC_TELEMED_TEST_MODE ?? "true").trim().toLowerCase() !== "false";
