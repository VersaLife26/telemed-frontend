import type { Surface } from "@/lib/consumer/surface";

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
