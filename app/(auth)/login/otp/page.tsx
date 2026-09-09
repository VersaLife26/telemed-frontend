import { SURFACE } from "@/lib/consumer/surface";
import DoctorPage from "@/components/consumer/pages/doctor__login__otp";
import PatientPage from "@/components/consumer/pages/patient__login__otp";

/**
 * /login/otp -- served by doctor, patient.
 *
 * Route groups organise files; they do not namespace URLs. All three
 * surfaces publish this path, so one route file owns it and dispatches on
 * the surface this deployment was built for. Only the matching branch ships:
 * SURFACE is fixed at build time and the other imports are dead code.
 */
export default async function Page() {
  if (SURFACE === "doctor") return <DoctorPage />;
  return <PatientPage />;
}
