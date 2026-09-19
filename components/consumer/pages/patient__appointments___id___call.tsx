import { PatientCall } from "@/components/consumer/call/patient-call";

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PatientCall appointmentId={id} />;
}
