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
