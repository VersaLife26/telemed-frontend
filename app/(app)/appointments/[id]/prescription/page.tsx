import { PrescriptionClient } from "@/components/consumer/prescription-client";

export default async function PrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PrescriptionClient appointmentId={id} />;
}
