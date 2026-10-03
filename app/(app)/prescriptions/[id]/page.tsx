import { PatientPrescriptionClient } from "@/components/consumer/patient-prescription-client";

export default async function PatientPrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PatientPrescriptionClient prescriptionId={id} />;
}
