import type { Metadata } from "next";

import { SURFACE } from "@/lib/consumer/surface";
import AdminPage from "@/components/admin/pages/admin__doctors___id_";
import PatientPage from "@/components/consumer/pages/patient__doctors___id_";

/**
 * /doctors/[id] -- served by admin, patient.
 *
 * Route groups organise files; they do not namespace URLs. All three
 * surfaces publish this path, so one route file owns it and dispatches on
 * the surface this deployment was built for. Only the matching branch ships:
 * SURFACE is fixed at build time and the other imports are dead code.
 */
export const metadata: Metadata =
  SURFACE === "admin" ? { title: "Credential review" } : {};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (SURFACE === "admin") return <AdminPage params={params} />;
  return <PatientPage params={params} />;
}
