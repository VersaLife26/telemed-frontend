import { PaymentClient } from "@/components/consumer/payment-client";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PaymentClient appointmentId={id} />;
}
