import { PatientMedicalReportClient } from "@/components/consumer/patient-medical-report-client";

export default async function PatientMedicalReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PatientMedicalReportClient reportId={id} />;
}
