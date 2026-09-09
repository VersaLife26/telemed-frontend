import { ClinicalNotesClient } from "@/components/consumer/clinical-notes-client";

export default async function ClinicalNotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClinicalNotesClient appointmentId={id} />;
}
