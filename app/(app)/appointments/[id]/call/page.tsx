import { SURFACE } from "@/lib/consumer/surface";
import DoctorPage from "@/components/consumer/pages/doctor__appointments___id___call";
import PatientPage from "@/components/consumer/pages/patient__appointments___id___call";

/**
 * /appointments/[id]/call -- served by doctor, patient.
 *
 * Route groups organise files; they do not namespace URLs. All three
 * surfaces publish this path, so one route file owns it and dispatches on
 * the surface this deployment was built for. Only the matching branch ships:
 * SURFACE is fixed at build time and the other imports are dead code.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (SURFACE === "doctor") return <DoctorPage params={params} />;
  return <PatientPage params={params} />;
}
