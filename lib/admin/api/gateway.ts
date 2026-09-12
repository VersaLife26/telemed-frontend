import "server-only";

import { serverEnv } from "@/lib/admin/env";
import type { AdminRole } from "@/lib/admin/api/types";
import { identityFrom } from "@/lib/admin/auth/access";
import { ADMIN_PATH_PREFIX, clientAddress, forwardingHeaders } from "./upstream";

/**
 * Server-side plumbing between this console and telemed-api-gateway.
 *
 * Nothing in this module may be imported from a client component: the
 * `server-only` guard turns that mistake into a build error rather than a
 * bundle that ships an access token to the browser.
 *
 * The pure half — path validation, client-address resolution, response
 * shaping — lives in `./upstream`, which carries no secrets and is therefore
 * unit-testable. This file is the half that touches the caller's identity.
 */

export { ADMIN_PATH_PREFIX, clientAddress, forwardingHeaders };

export function gatewayBaseUrl(): string {
  return serverEnv().TELEMED_API_URL.replace(/\/$/, "");
}

/** Anything carrying request headers: a Request, or `await headers()`. */
export type HeaderSource = Request | { headers: Headers };

/** The Access token to forward upstream, and the roles the platform grants. */
export type SessionCredentials =
  | { token: string; roles: AdminRole[] }
  | { token: null; roles: AdminRole[]; reason: "no-session" | "unreachable" };

/**
 * Reads the Cloudflare Access token and the caller's admin roles.
 *
 * Both used to come out of the encrypted Auth.js cookie: the token was
 * Keycloak's, and the roles were `realm_access.roles` copied off it on every
 * refresh. Neither exists now. Access authenticates the hostname and puts its
 * own JWT on the request, and the role comes from this platform's admin_users
 * row via `GET /api/v1/admin/me`.
 *
 * The roles are still a server-side fact the browser cannot influence, which
 * is what makes them safe to authorise on in the BFF (see `canCallApi`) --
 * they are read from the backend with the caller's own token, not from
 * anything the client sent.
 *
 * `unreachable` is kept distinct from `no-session` on purpose: a backend that
 * cannot be reached must not read as "this person has no roles", which would
 * turn an outage into a silent, total loss of admin access.
 */
export async function accessTokenFor(request: HeaderSource): Promise<SessionCredentials> {
  const result = await identityFrom(request);
  if (!result.ok) {
    return {
      token: null,
      roles: [],
      reason: result.reason === "unreachable" ? "unreachable" : "no-session",
    };
  }
  return { token: result.identity.token, roles: result.identity.roles };
}

/**
 * Distinguishes an IP-allowlist rejection from a role rejection.
 *
 * Both arrive as `403 FORBIDDEN` — `IPAllowlist` calls `httpx.ErrForbidden`,
 * the same error `RequireRole` uses — so the code alone cannot tell them
 * apart. What *can* tell them apart is the middleware order in the gateway's
 * `composeMiddleware`: for admin routes, `IPAllowlist` wraps `RequireAuth`,
 * so it runs first. An unauthenticated request therefore answers
 *
 *   403  → the IP was refused before authentication was even attempted
 *   401  → the IP was fine; the request simply had no token
 *
 * This probe sends exactly that: a token-free request carrying the address the
 * console resolved for the caller.
 *
 * Two things guard the probe itself. It is an **unauthenticated** outbound call
 * that any visitor to `/ip-blocked` can cause, so the answer is memoised per
 * resolved address for `PROBE_TTL_MS`: without that, `IpAllowlistWatcher`'s
 * ten-second poll multiplied by the number of open tabs is a free amplifier
 * pointed at the gateway. And the address is resolved by `clientAddress`, never
 * copied from the caller's own `X-Forwarded-For`, so the endpoint cannot be
 * used to enumerate the allowlist by guessing addresses.
 */
const PROBE_TTL_MS = 5_000;
const probeCache = new Map<string, { at: number; blocked: boolean }>();

export async function ipAllowlistRejects(request: HeaderSource): Promise<boolean> {
  const address = clientAddress(request.headers) ?? "unknown";

  const cached = probeCache.get(address);
  const now = Date.now();
  if (cached && now - cached.at < PROBE_TTL_MS) return cached.blocked;

  let blocked = false;
  try {
    const response = await fetch(`${gatewayBaseUrl()}/${ADMIN_PATH_PREFIX}/doctors/pending`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...forwardingHeaders(request.headers),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    blocked = response.status === 403;
  } catch {
    // The probe failing tells us nothing about the allowlist, so claim
    // nothing. The caller keeps the original error.
    blocked = false;
  }

  // Bounded so a burst of distinct addresses cannot grow the map without end.
  if (probeCache.size > 512) probeCache.clear();
  probeCache.set(address, { at: now, blocked });
  return blocked;
}
