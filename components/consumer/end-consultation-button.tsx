"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PhoneOff } from "lucide-react";

import { Button } from "@/components/consumer/ui/Button";
import { browserApi } from "@/lib/consumer/api/client";
import { endConsultBody, endPath } from "@/lib/consumer/features/consult";

export function EndConsultationButton({
  appointmentId,
  consultationId,
}: {
  appointmentId: string;
  consultationId?: string;
}) {
  const router = useRouter();
  const [ending, setEnding] = useState(false);
  const [ended, setEnded] = useState(false);

  if (ended) {
    return (
      <span className="inline-flex items-center gap-1.5 text-body-sm font-medium text-muted">
        <CheckCircle2 className="size-4 text-brand" />
        Ended
      </span>
    );
  }

  async function handleEnd() {
    if (
      !window.confirm(
        "End this consultation session? Once ended, neither you nor the patient will be able to rejoin.",
      )
    ) {
      return;
    }
    setEnding(true);
    try {
      const target = consultationId || appointmentId;
      await browserApi(endPath(target), {
        method: "POST",
        body: endConsultBody(),
      });
      setEnded(true);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not end consultation");
    } finally {
      setEnding(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      busy={ending}
      leading={<PhoneOff className="size-4" />}
      onClick={() => void handleEnd()}
      className="border-danger/40 text-danger can-hover:hover:bg-danger-surface"
    >
      End visit
    </Button>
  );
}
