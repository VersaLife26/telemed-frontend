import { Suspense } from "react";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { IntakeClient } from "./intake-client";

export default async function IntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<FormSkeleton />}>
      <IntakeClient doctorId={id} />
    </Suspense>
  );
}
