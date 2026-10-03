import { MedicalReportClient } from "@/components/consumer/medical-report-client";

export default async function DoctorMedicalReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MedicalReportClient appointmentId={id} />;
}
