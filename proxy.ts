import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

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
 * 2. **The admin console's own middleware** — the Auth.js session and role
 *    check, and the per-request CSP nonce. Reached through a dynamic import
 *    because `@/auth` constructs the Auth.js instance at module load and needs
 *    AUTH_SECRET; a static import would evaluate that in the patient and
 *    doctor builds, which have no such secret and no such console.
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
    // Auth.js types its wrapped handler for the route-handler position, where
    // the second argument carries route params. In the middleware position it
    // is the NextFetchEvent and the params are never read, so the shape is
    // asserted rather than fabricated.
    return adminProxy(request as never, event as never);
  }

  return NextResponse.next();
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
