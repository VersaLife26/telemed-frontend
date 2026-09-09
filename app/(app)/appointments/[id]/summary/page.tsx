import { VisitSummaryClient } from "@/components/consumer/visit-summary-client";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VisitSummaryClient appointmentId={id} />;
}
