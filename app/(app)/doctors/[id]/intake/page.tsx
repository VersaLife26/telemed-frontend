import { Suspense } from "react";
import { IntakeClient } from "./intake-client";

export default async function IntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="text-body text-text-muted">Loading…</p>}>
      <IntakeClient doctorId={id} />
    </Suspense>
  );
}
