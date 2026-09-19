import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { ACCESS_MAX_AGE, REFRESH_MAX_AGE, authCookieOptions } from "@/lib/consumer/auth/cookie-options";
import { cookieHeaderWithAuth, fetchRefreshedTokens, shouldAttemptRefresh } from "@/lib/consumer/auth/refresh";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/consumer/env";
import { SURFACE } from "@/lib/consumer/surface";
import { servedBy } from "@/lib/surface-routes";

/**
 * Runs before any page is rendered. Next.js 16's `proxy.ts`, the renamed
 * successor to `middleware.ts`.
 *
 * Two jobs, in this order:
 *
 * 1. **Surface scoping.** One build contains the routes of all three surfaces,
 *    so this deployment must refuse the ones it does not serve. A patient
 *    deployment answering `/audit` would fail on a missing admin session
 *    rather than leak anything, but relying on that is relying on an error, so
 *    the table in `lib/surface-routes.ts` decides first and returns a real 404.
 *
 * 2. **The admin console's own middleware** — the Cloudflare Access check and
 *    the per-request CSP nonce. Still reached through a dynamic import so the
 *    patient and doctor builds never evaluate the admin console's modules.
 *
 * 3. **Session refresh** on patient and doctor. Access cookies last 15 minutes;
 *    the refresh cookie lasts 7 days. Without this step the access cookie
 *    vanishing looks like a logout even though the session is still live.
 */
export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  if (!servedBy(SURFACE, pathname)) {
    // A rewrite to a 404 rather than a redirect: the path does not exist on
    // this surface, and saying so is the whole answer.
    return new NextResponse(null, { status: 404 });
  }

  if (SURFACE === "admin") {
    const { adminProxy } = await import("@/lib/admin/proxy-impl");
    return adminProxy(request);
  }

  return attachRefreshedSession(request);
}

async function attachRefreshedSession(request: NextRequest) {
  const hasAccess = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value ?? "";
  if (!shouldAttemptRefresh(request.nextUrl.pathname, hasAccess, Boolean(refresh))) {
    return NextResponse.next();
  }

  const result = await fetchRefreshedTokens(refresh);
  if (!result.ok) {
    const res = NextResponse.next();
    if (result.invalidate) {
      res.cookies.delete(ACCESS_COOKIE);
      res.cookies.delete(REFRESH_COOKIE);
    }
    return res;
  }

  const headers = new Headers(request.headers);
  headers.set(
    "cookie",
    cookieHeaderWithAuth(request.headers.get("cookie") ?? "", result.tokens.access_token, result.tokens.refresh_token),
  );
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(ACCESS_COOKIE, result.tokens.access_token, authCookieOptions(ACCESS_MAX_AGE));
  res.cookies.set(REFRESH_COOKIE, result.tokens.refresh_token, authCookieOptions(REFRESH_MAX_AGE));
  return res;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *   _next/static, _next/image  — served with the next.config.ts CSP
     *   favicon.ico, icon files    — same
     * Note that RSC/data requests for a page DO match, and should: they need
     * the same checks as the initial document.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png|robots\\.txt).*)",
  ],
};
