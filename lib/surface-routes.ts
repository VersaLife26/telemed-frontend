import { TEST_MODE } from "@/lib/consumer/env";
import type { Surface } from "@/lib/consumer/surface";

/**
 * The developer test surface, published by the patient and doctor surfaces.
 *
 * BOTH, rather than one, because the thing it tests is a two-party call: the
 * natural way to drive it is the patient app in one tab and the doctor app in
 * another, and publishing it on only one surface would mean testing the call
 * against itself.
 *
 * NOT the admin console, and that is a decision rather than an oversight.
 * Every admin request goes through adminProxy, which requires an Auth.js
 * session and a role claim -- so /test there would either demand the login it
 * exists to avoid, or need a hole punched in the one surface with an IP
 * allowlist, `__Host-` cookies and a dedicated origin. The test surface has no
 * business being the first exception to any of that.
 *
 * TEST_MODE off empties the list, so /test is a 404 decided here, before any
 * page module runs -- the same mechanism that keeps the admin console's routes
 * off the patient deployment.
 */
const TEST_ROUTES: readonly string[] = TEST_MODE ? ["/test", "/test/*"] : [];

/**
 * Which URLs each surface publishes.
 *
 * One Next application serves three surfaces, so the build contains every
 * route for all three. Without this table the patient deployment would answer
 * `/audit` and `/users` with the admin console's pages -- rendering would fail
 * on a missing session rather than leaking data, but "it errors" is not an
 * access control. The table is the access control: anything a surface does not
 * own is a 404 on that surface, decided before any page module runs.
 *
 * Derived from the three original applications' route trees, so it is a record
 * of what each app served before consolidation, not a new policy.
 */
const ROUTES: Record<Surface, readonly string[]> = {
  patient: [
    "/",
    "/home",
    "/doctors",
    "/doctors/*",
    "/appointments",
    "/appointments/*",
    "/vault",
    "/profile",
    "/login",
    "/login/otp",
    "/register",
    "/api/auth/email/login",
    "/api/auth/email/register",
    "/api/auth/google",
    "/api/auth/google/config",
    "/api/auth/logout",
    "/api/auth/otp/send",
    "/api/auth/otp/verify",
    "/api/proxy/*",
    ...TEST_ROUTES,
  ],
  doctor: [
    "/",
    "/dashboard",
    "/queue",
    "/availability",
    "/earnings",
    "/verification-pending",
    "/profile",
    "/appointments/*",
    "/login",
    "/login/otp",
    "/register",
    "/api/auth/email/login",
    "/api/auth/google",
    "/api/auth/google/config",
    "/api/auth/logout",
    "/api/auth/otp/send",
    "/api/auth/otp/verify",
    "/api/proxy/*",
    ...TEST_ROUTES,
  ],
  admin: [
    "/",
    "/users",
    "/doctors",
    "/doctors/*",
    "/appointments",
    "/payments",
    "/disputes",
    "/audit",
    "/content",
    "/settings",
    "/settings/admins",
    "/login",
    "/ip-blocked",
    "/no-access",
    "/api/auth/*",
    "/api/gateway/*",
    "/api/ip-check",
  ],
};

/**
 * True when `pathname` is served by `surface`.
 *
 * A trailing `/*` matches that prefix and anything below it. Matching is on
 * the whole segment, so `/doctors/*` does not match `/doctorsomething`.
 */
export function servedBy(surface: Surface, pathname: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  for (const pattern of ROUTES[surface]) {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (path === prefix || path.startsWith(`${prefix}/`)) return true;
    } else if (path === pattern) {
      return true;
    }
  }
  return false;
}
