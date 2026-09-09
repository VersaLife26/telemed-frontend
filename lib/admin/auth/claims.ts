import { ADMIN_ROLES, type AdminRole, isAdminRole } from "@/lib/admin/api/types";

/**
 * Claim handling for Keycloak 26 access tokens.
 *
 * The console decodes the token only to read `realm_access.roles`, `exp` and
 * the authentication-method claims. It never *verifies* the signature — that
 * is the gateway's and each service's job, and duplicating it here would
 * create a second, weaker verifier that could disagree with the real one.
 * Everything decoded here is used for UI affordances (which nav items to
 * render) and for the 2FA gate; nothing decoded here grants access to data.
 */

export interface KeycloakAccessTokenClaims {
  exp?: number;
  iat?: number;
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  /** Authentication Context Class Reference — Keycloak's LoA marker. */
  acr?: string;
  /** Authentication Methods References, e.g. ["pwd", "otp"]. */
  amr?: string[] | string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  telemed_user_id?: string;
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
export function decodeAccessToken(token: string): KeycloakAccessTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = parts[1];
  if (!payload) return null;
  try {
    const claims = decodeSegment(payload);
    return typeof claims === "object" && claims !== null
      ? (claims as KeycloakAccessTokenClaims)
      : null;
  } catch {
    return null;
  }
}

/**
 * Extracts the admin roles the token carries, in the platform's order of
 * privilege. Anything that is not one of the five admin roles — `patient`,
 * `doctor`, `offline_access`, Keycloak's own default roles — is dropped.
 */
export function adminRolesFrom(claims: KeycloakAccessTokenClaims | null): AdminRole[] {
  const raw = claims?.realm_access?.roles ?? [];
  const found = raw.filter(isAdminRole);
  return ADMIN_ROLES.filter((role) => found.includes(role));
}

/**
 * Did the user actually complete a second factor?
 *
 * The V2 docs make 2FA mandatory on this surface. Keycloak signals it two
 * ways depending on realm configuration, and we accept either:
 *
 *  - `amr` contains an OTP-ish method. This is the direct signal.
 *  - `acr` equals the level-of-assurance value the realm maps 2FA to
 *    (`AUTH_ACR_2FA`, default "2fa"). Realms configured with the
 *    "acr-to-loa" mapping report the level rather than the method.
 *
 * If a realm reports neither, `AUTH_REQUIRE_2FA=false` disables the gate for
 * local development. It defaults to on, so a production deployment that
 * forgets to configure it fails closed — and in production the variable is
 * ignored entirely, so a deployment that *sets* it wrong fails closed too.
 */
const OTP_METHODS = new Set(["otp", "mfa", "totp", "hwk", "sms", "swk"]);

export function satisfiedSecondFactor(claims: KeycloakAccessTokenClaims | null): boolean {
  if (!claims) return false;

  const amr = Array.isArray(claims.amr)
    ? claims.amr
    : typeof claims.amr === "string"
      ? [claims.amr]
      : [];
  if (amr.some((m) => OTP_METHODS.has(m.toLowerCase()))) return true;

  const requiredAcr = process.env.AUTH_ACR_2FA ?? "2fa";
  if (claims.acr && claims.acr === requiredAcr) return true;
  // Keycloak's acr mapper sometimes emits the numeric LoA ("2") instead of
  // the mapped name when the reverse lookup misses. LoA 2 is the OTP step.
  if (claims.acr === "2") return true;

  return false;
}

/**
 * Whether the 2FA gate is enforced.
 *
 * In production: always. The V2 docs make 2FA mandatory on this surface, and
 * an environment variable that can switch a mandatory control off is the exact
 * shape the platform review called out twice — the gateway's IP allowlist and
 * the admin-origin check both "existed" the same way until an unset variable
 * turned them into decoration (F17). A dev stack with no TOTP configured can
 * still opt out; a production one cannot, whatever it puts in its config map.
 */
export function twoFactorRequired(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return (process.env.AUTH_REQUIRE_2FA ?? "true").toLowerCase() !== "false";
}
