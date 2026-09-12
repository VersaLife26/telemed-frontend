import type { Metadata } from "next";

import { SURFACE } from "@/lib/consumer/surface";
import DoctorPage from "@/components/consumer/pages/doctor__login";
import PatientPage from "@/components/consumer/pages/patient__login";

/**
 * /login -- served by doctor and patient.
 *
 * Route groups organise files; they do not namespace URLs. Both surfaces
 * publish this path, so one route file owns it and dispatches on the surface
 * this deployment was built for. Only the matching branch ships: SURFACE is
 * fixed at build time and the other import is dead code.
 *
 * The admin console used to be a third branch here. It is not any more:
 * Cloudflare Access authenticates admin.versalifehealth.com at the edge, so a
 * sign-in page inside the application would be a login form behind a login.
 * `lib/surface-routes.ts` no longer lists /login for admin, so the path 404s
 * there rather than rendering a patient screen.
 */
export const metadata: Metadata = {};

export default async function Page() {
  if (SURFACE === "doctor") return <DoctorPage />;
  return <PatientPage />;
}
