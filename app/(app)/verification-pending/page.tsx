import Link from "next/link";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";

export default function VerificationPendingPage() {
  return (
    <Card className="flex max-w-xl flex-col gap-4">
      <h1 className="text-h4 text-black">Verification pending</h1>
      <p className="text-body text-text-muted">
        SLMC documents are reviewed in the admin console. Once approved, slots generate and patients
        can book you.
      </p>
      <Link href="/dashboard" className="max-w-xs">
        <Button>Back to dashboard</Button>
      </Link>
    </Card>
  );
}
