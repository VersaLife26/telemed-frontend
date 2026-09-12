import "server-only";

import { serverEnv } from "@/lib/admin/env";
import type { AdminRole } from "@/lib/admin/api/types";
import { isAdminRole } from "@/lib/admin/api/types";
import { ADMIN_PATH_PREFIX, forwardingHeaders } from "@/lib/admin/api/upstream";
import { decodeAccessClaims } from "./claims";
import { accessJwtFrom, type HeaderSource } from "./access-token";

/**
 * Cloudflare Access is the admin console's identity provider.
 *
 * There is no login inside this application any more, and that is the point:
 * `admin.versalifehealth.com` is fronted by an Access application, so a request
 * only reaches this Worker once Access has already authenticated the person
 * against its policy. By the time any code here runs, the caller is known.
 *
 * Access proves it two ways, and either is accepted:
 *
 *   Cf-Access-Jwt-Assertion   the header, set on every proxied request
 *   CF_Authorization          the cookie, for a request the header missed
 *
 * The JWT is decoded here and never verified. That is deliberate and matches
 * what the Keycloak implementation did for the same reason: telemed-backend
 * verifies it against ADMIN_ISSUER/ADMIN_JWKS_URL, and a second verifier in the
 * console would be a weaker one that could disagree with the real one. Nothing
 * decoded here grants access to data -- every byte of that comes back from the
 * backend, which checks the token itself.
 */

export { ACCESS_JWT_HEADER, ACCESS_JWT_COOKIE, accessJwtFrom } from "./access-token";
export type { HeaderSource } from "./access-token";

/**
 * Who the caller is, and what this platform lets them do.
 *
 * Identity comes from the Access token. The ROLE does not: Access says who
 * someone is, and the admin_users table in telemed-backend says what they may
 * do. Those are two different questions and the split is the whole reason
 * removing Keycloak was safe -- under Keycloak the realm answered both, so a
 * role lived in the token; now `GET /api/v1/admin/me` answers the second one
 * and the token carries no roles at all.
 */
export interface AdminIdentity {
  /** The raw Access JWT, forwarded upstream as the bearer token. */
  token: string;
  email: string;
  name: string;
  /** Unix seconds at which the Access session expires, when the token says. */
  expiresAt: number | null;
  /**
   * Empty when the caller passed Access but has no active admin_users row.
   * That is a real and expected state -- being admitted by the Access policy
   * is authentication, not authorisation -- and it renders /no-access rather
   * than an error.
   */
  roles: AdminRole[];
}

export type IdentityResult =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; reason: "no-access-token" | "unreachable" };

/**
 * Resolves the caller from anything carrying request headers.
 *
 * Deliberately takes the headers rather than reaching for `next/headers`: this
 * module is imported by the BFF route handler and by `lib/admin/api/gateway`,
 * neither of which is a server component. The request-scoped wrapper for
 * server components lives in `./current`, which is the only file here that
 * imports `next/headers`.
 */
export async function identityFrom(source: HeaderSource): Promise<IdentityResult> {
  const token = accessJwtFrom(source);
  if (!token) return { ok: false, reason: "no-access-token" };

  const claims = decodeAccessClaims(token);
  const email = claims?.email ?? "";

  const me = await fetchMe(token, source);
  if (me === "unreachable") return { ok: false, reason: "unreachable" };

  return {
    ok: true,
    identity: {
      token,
      email,
      // Access tokens carry no display name. The admin_users row is the only
      // place one exists, and it is frequently blank, so the local part of the
      // address is the honest fallback rather than an invented name.
      name: me?.display_name?.trim() || email.split("@")[0] || email,
      expiresAt: typeof claims?.exp === "number" ? claims.exp : null,
      roles: me && isAdminRole(me.role) ? [me.role] : [],
    },
  };
}

interface MeResponse {
  email: string;
  display_name: string;
  role: string;
  active: boolean;
}

/**
 * Reads the caller's own admin_users row.
 *
 * `null` means Access admitted them and this platform has no active row for
 * them: a 401/403/404 from the backend is that answer, not a failure. Anything
 * else -- a network error, a 5xx -- is "unreachable", which must NOT be
 * flattened into "no roles": that would turn a backend outage into every
 * administrator silently losing their access, which is the failure mode most
 * likely to happen during an incident and least likely to be understood.
 */
async function fetchMe(token: string, source: HeaderSource): Promise<MeResponse | null | "unreachable"> {
  const base = serverEnv().TELEMED_API_URL.replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/${ADMIN_PATH_PREFIX}/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...forwardingHeaders(source.headers),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return null;
    }
    if (!response.ok) {
      console.error(
        `adminIdentity: ${base}/${ADMIN_PATH_PREFIX}/me answered ${response.status}; ` +
          "cannot determine the caller's admin role",
      );
      return "unreachable";
    }

    const body = (await response.json()) as { data?: MeResponse } | MeResponse;
    const data = "data" in body && body.data ? body.data : (body as MeResponse);
    if (!data || typeof data.role !== "string") return null;
    // A deactivated row resolves to nothing, matching the backend's own
    // Directory, which refuses an inactive admin rather than erroring.
    if (data.active === false) return null;
    return data;
  } catch (error) {
    // Logged, not swallowed. This is the one call standing between a valid
    // Access session and a usable console, and without the reason an operator
    // gets a generic error page and a digest to guess from.
    console.error(
      `adminIdentity: could not reach ${base}/${ADMIN_PATH_PREFIX}/me: ` +
        (error instanceof Error ? `${error.name}: ${error.message}` : String(error)),
    );
    return "unreachable";
  }
}

/**
 * Where the user menu's sign-out points.
 *
 * Access owns the session, so signing out means ending the Access session, not
 * clearing a cookie this application controls. Clearing anything locally would
 * leave the person signed in and look like it had worked.
 */
export const ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout";

