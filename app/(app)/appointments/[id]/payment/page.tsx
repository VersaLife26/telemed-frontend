import { Suspense } from "react";
import { PaymentClient } from "@/components/consumer/payment-client";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<FormSkeleton />}>
      <PaymentClient appointmentId={id} />
    </Suspense>
  );
}
