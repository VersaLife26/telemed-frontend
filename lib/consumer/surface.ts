/**
 * Which of the three surfaces this deployment serves.
 *
 * One Next application, three route groups, three deployments. The build is
 * identical for all three; TELEMED_SURFACE is what makes an image the patient
 * app rather than the doctor app -- it selects the cookie names, the role a
 * session is required to hold, and (in middleware.ts) which route group is
 * reachable at all.
 *
 * Three origins rather than one is deliberate and load-bearing. The admin
 * console's session cookie carries the `__Host-` prefix, which a browser only
 * honours on a dedicated origin, and the gateway splits CORS three ways. One
 * origin would put a patient-facing XSS in the same cookie jar as the admin
 * console.
 */
export type Surface = "patient" | "doctor" | "admin";

const SURFACES: readonly Surface[] = ["patient", "doctor", "admin"];

function read(): Surface {
  const raw = process.env.TELEMED_SURFACE ?? process.env.NEXT_PUBLIC_TELEMED_SURFACE;
  if (raw && (SURFACES as readonly string[]).includes(raw)) {
    return raw as Surface;
  }
  // Failing closed on a missing surface would break `next build`, which has no
  // deployment identity. Defaulting to "patient" is the least-privileged of the
  // three: it never unlocks the admin console, and middleware.ts refuses every
  // route group that does not match, so a misconfigured deployment serves 404s
  // rather than another surface's pages.
  return "patient";
}

export const SURFACE: Surface = read();

/** True when this deployment serves the given surface. */
export function isSurface(s: Surface): boolean {
  return SURFACE === s;
}
