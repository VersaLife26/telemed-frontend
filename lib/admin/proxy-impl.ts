import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { canVisit, groupForPath } from "@/lib/admin/rbac";
import { contentSecurityPolicy } from "@/lib/admin/security/csp";

/**
 * The session reader for the proxy.
 *
 * Built from `authConfig`, NOT from `@/auth`. That is the canonical Auth.js v5
 * edge split and here it is load-bearing rather than stylistic: `@/auth`
 * registers the Keycloak provider and a `jwt` callback that performs a
 * token-refresh `fetch` against the identity provider. Importing it into the
 * proxy pulls all of that into the runtime that executes on EVERY request for
 * every page, including ones that need no session at all.
 *
 * `authConfig` carries the cookie name, the JWT settings and the `session`
 * callback -- everything needed to READ a session and nothing needed to mint
 * one. Signing in stays in the route handler, where the Node runtime is
 * declared and the provider belongs.
 */
const { auth } = NextAuth(authConfig);

/**
 * Runs before any page is rendered.
 *
 * This is Next.js 16's `proxy.ts`, the renamed successor to `middleware.ts`.
 * The API is unchanged; the file name and the exported function name are not.
 *
 * Two jobs, in this order:
 *
 * 1. **Authentication and role check.** A request for a page the caller's
 *    role cannot use is redirected here, before the server component tree is
 *    built — so no data fetch for that page ever starts. The gateway and
 *    admin-service enforce the same matrix; this is the cheap first pass, not
 *    the control.
 *
 * 2. **CSP with a per-request nonce.** App Router injects inline scripts for
 *    the Flight payload, so the nonce is generated here, forwarded to the
 *    render via the `x-nonce` request header (Next.js reads it and stamps its
 *    own script tags), and named in the response's CSP.
 *
 * Static assets are excluded by the matcher and get their nonce-free CSP from
 * `next.config.ts` instead, so no response ever carries two CSP headers.
 */

const PUBLIC_PATHS = new Set<string>(["/login", "/ip-blocked", "/no-access"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Auth.js callback/signin endpoints, and the IP allowlist probe the
  // ip-blocked page uses, must be reachable without a session.
  return pathname.startsWith("/api/auth/") || pathname === "/api/ip-check";
}

export const adminProxy = auth(function proxy(request) {
  const { pathname, search } = request.nextUrl;

  // --- CSP nonce --------------------------------------------------------
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV === "development";
  const csp = contentSecurityPolicy({ nonce, dev: isDev });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const withSecurity = (response: NextResponse): NextResponse => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  const pass = () =>
    withSecurity(NextResponse.next({ request: { headers: requestHeaders } }));

  if (isPublic(pathname)) return pass();

  const session = request.auth;

  // --- authentication ---------------------------------------------------
  if (!session?.user || session.error) {
    // The BFF answers with JSON, not a redirect: a fetch() that follows a
    // redirect to an HTML login page produces a parse error three layers away
    // from the actual cause.
    if (pathname.startsWith("/api/")) {
      return withSecurity(
        NextResponse.json(
          {
            code: "UNAUTHORIZED",
            message: "authentication required",
          },
          { status: 401 },
        ),
      );
    }
    const login = new URL("/login", request.nextUrl.origin);
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    if (session?.error === "RefreshFailed") login.searchParams.set("reason", "expired");
    return withSecurity(NextResponse.redirect(login));
  }

  // --- authorization ----------------------------------------------------
  const roles = session.roles ?? [];
  if (roles.length === 0) {
    return withSecurity(NextResponse.redirect(new URL("/no-access", request.nextUrl.origin)));
  }

  if (!canVisit(roles, pathname)) {
    const denied = new URL("/no-access", request.nextUrl.origin);
    const group = groupForPath(pathname);
    if (group) denied.searchParams.set("area", group);
    return withSecurity(NextResponse.redirect(denied));
  }

  return pass();
});

/** 128 bits of randomness, base64. Web Crypto is available in the edge runtime. */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

