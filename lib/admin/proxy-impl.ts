import { NextResponse, type NextRequest } from "next/server";

import { accessJwtFrom } from "@/lib/admin/auth/access-token";
import { contentSecurityPolicy } from "@/lib/admin/security/csp";



/**
 * Runs before any page is rendered.
 *
 * This is Next.js 16's `proxy.ts`, the renamed successor to `middleware.ts`.
 * The API is unchanged; the file name and the exported function name are not.
 *
 * Two jobs, in this order:
 *
 * 1. **Authentication.** Cloudflare Access fronts this hostname, so a request
 *    that reaches the Worker has already been authenticated and carries its
 *    JWT. This checks the token is actually there and answers 401 when it is
 *    not, which in practice only happens if the Access application is removed
 *    or misrouted — a state worth failing loudly on rather than rendering an
 *    empty console over.
 *
 *    The ROLE check is not here any more. Roles used to ride in the session
 *    cookie and could be read synchronously; they now come from the
 *    admin_users row via `GET /api/v1/admin/me`, which is a network call and
 *    does not belong on every request for every asset. It moved to the console
 *    layout, which renders once per page and already needs the same answer to
 *    draw the nav. The real control is unchanged either way: the gateway and
 *    admin-service enforce the matrix on every call.
 *
 * 2. **CSP with a per-request nonce.** App Router injects inline scripts for
 *    the Flight payload, so the nonce is generated here, forwarded to the
 *    render via the `x-nonce` request header (Next.js reads it and stamps its
 *    own script tags), and named in the response's CSP.
 *
 * Static assets are excluded by the matcher and get their nonce-free CSP from
 * `next.config.ts` instead, so no response ever carries two CSP headers.
 */

// /login is gone: Cloudflare Access is the sign-in, and a page that offered a
// second one inside a hostname Access already gated would be a login form
// behind a login.
const PUBLIC_PATHS = new Set<string>(["/ip-blocked", "/no-access"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // The IP allowlist probe the ip-blocked page uses runs before the console is
  // usable and must stay reachable.
  return pathname === "/api/ip-check";
}

export async function adminProxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // --- CSP nonce --------------------------------------------------------
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV === "development";
  const csp = contentSecurityPolicy({ nonce, dev: isDev });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // The console layout needs the path to run the role check that used to live
  // here, and a server component cannot read it any other way.
  requestHeaders.set("x-pathname", pathname);

  const withSecurity = (response: NextResponse): NextResponse => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  const pass = () =>
    withSecurity(NextResponse.next({ request: { headers: requestHeaders } }));

  if (isPublic(pathname)) return pass();

  // --- authentication ---------------------------------------------------
  // No redirect to a login page, because there is nowhere to redirect TO.
  // Access challenges the browser itself, at the edge, before this runs; if
  // its token is missing the request did not come through Access and sending
  // the caller deeper into the console would render a shell that cannot load
  // any data.
  if (!accessJwtFrom(request)) {
    if (pathname.startsWith("/api/")) {
      return withSecurity(
        NextResponse.json(
          { code: "UNAUTHORIZED", message: "authentication required" },
          { status: 401 },
        ),
      );
    }
    return withSecurity(
      new NextResponse(
        "This console is reached through Cloudflare Access. Open https://admin.versalifehealth.com in a browser and sign in when prompted.",
        { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } },
      ),
    );
  }

  return pass();
}

/** 128 bits of randomness, base64. Web Crypto is available in the edge runtime. */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

