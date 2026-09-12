/**
 * Claim handling for Cloudflare Access tokens.
 *
 * The console decodes the token only to read `email` and `exp`. It never
 * *verifies* the signature — that is telemed-backend's job, which checks it
 * against ADMIN_ISSUER/ADMIN_JWKS_URL, and duplicating it here would create a
 * second, weaker verifier that could disagree with the real one. Everything
 * decoded here is used for display; nothing decoded here grants access to data.
 *
 * This replaced an equivalent module for Keycloak 26 access tokens. Two claims
 * it used to read are deliberately gone:
 *
 *   realm_access.roles  Access issues no roles. Authorisation now comes from
 *                       the admin_users row via `GET /api/v1/admin/me` — see
 *                       lib/admin/auth/access.ts.
 *   amr / acr           The 2FA gate was a defence-in-depth re-check of
 *                       Keycloak's browser flow. Access authenticates before
 *                       any of this code runs, so whether a second factor was
 *                       required is a property of the Access policy and cannot
 *                       be re-checked from inside the application. Enforce it
 *                       there.
 */

export interface AccessTokenClaims {
  /** Unix seconds. */
  exp?: number;
  iat?: number;
  /** The Access application's audience tag. */
  aud?: string | string[];
  /** Issuer, e.g. https://versalife.cloudflareaccess.com. */
  iss?: string;
  /** Per-application, per-user identifier. Stable, but not an email. */
  sub?: string;
  /** The identity Access authenticated. This is what admin_users matches on. */
  email?: string;
  /** Present on service-token requests instead of an identity. */
  common_name?: string;
}

/** base64url → utf-8, without pulling in a JWT library for a read-only decode. */
function decodeSegment(segment: string): unknown {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPadding);
  const bytes = Uint8Array.from(binary, (c) => c.codePointAt(0) ?? 0);
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Returns the payload claims, or null if the token is not a readable JWT. */
export function decodeAccessClaims(token: string): AccessTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = parts[1];
  if (!payload) return null;
  try {
    const claims = decodeSegment(payload);
    return typeof claims === "object" && claims !== null ? (claims as AccessTokenClaims) : null;
  } catch {
    return null;
  }
}

/** Milliseconds until the Access session expires, or null when unknown. */
export function millisUntilExpiry(claims: AccessTokenClaims | null, now = Date.now()): number | null {
  if (!claims || typeof claims.exp !== "number") return null;
  return claims.exp * 1000 - now;
}
