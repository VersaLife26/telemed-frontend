import type { Metadata } from "next";

import { SURFACE } from "@/lib/consumer/surface";
import AdminPage from "@/components/admin/pages/admin__appointments";
import DoctorPage from "@/components/consumer/pages/doctor__appointments";
import PatientPage from "@/components/consumer/pages/patient__appointments";

/**
 * /appointments -- served by admin, patient.
 *
 * Route groups organise files; they do not namespace URLs. All three
 * surfaces publish this path, so one route file owns it and dispatches on
 * the surface this deployment was built for. Only the matching branch ships:
 * SURFACE is fixed at build time and the other imports are dead code.
 */
export const metadata: Metadata =
  SURFACE === "admin" ? { title: "Appointments" } : {};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (SURFACE === "admin") return <AdminPage searchParams={searchParams} />;
  if (SURFACE === "doctor") return <DoctorPage />;
  return <PatientPage />;
}
