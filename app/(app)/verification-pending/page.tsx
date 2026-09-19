import { ShieldCheck } from "lucide-react";

import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";

export default function VerificationPendingPage() {
  return (
    <Card variant="glass" className="flex max-w-xl flex-col items-start gap-4 p-8">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-tint text-brand"
      >
        <ShieldCheck className="size-6" />
      </span>
      <h1 className="text-h2 text-ink">Verification pending</h1>
      <p className="text-body text-muted">
        SLMC documents are reviewed in the admin console. Once approved, slots generate and
        patients can book you.
      </p>
      <ButtonLink href="/dashboard">Back to dashboard</ButtonLink>
    </Card>
  );
}
