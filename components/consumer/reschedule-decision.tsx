"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/consumer/ui/Button";
import { browserApi } from "@/lib/consumer/api/client";
import type { RescheduleRequest } from "@/lib/consumer/api/types";

export function RescheduleDecision({
  request,
  onChanged,
}: {
  request: RescheduleRequest;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  async function act(kind: "accept" | "decline") {
    setError(null);
    setBusy(kind);
    try {
      await browserApi(`/reschedule-requests/${request.id}/${kind}`, { method: "POST" });
      onChanged?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the request");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-[16px] bg-bg-gray px-4 py-3">
      <p className="text-body-sm text-black">
        The doctor asked to move this visit from{" "}
        <span className="font-medium">
          {request.original_start_at_local || request.original_start_at}
        </span>{" "}
        to{" "}
        <span className="font-medium">
          {request.proposed_start_at_local || request.proposed_start_at}
        </span>
        .
      </p>
      {request.reason ? (
        <p className="text-body-sm text-text-muted">Reason: {request.reason}</p>
      ) : null}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          fullWidth={false}
          disabled={busy !== null}
          onClick={() => act("accept")}
        >
          {busy === "accept" ? "Saving…" : "Accept new time"}
        </Button>
        <Button
          type="button"
          variant="outline"
          fullWidth={false}
          disabled={busy !== null}
          onClick={() => act("decline")}
        >
          {busy === "decline" ? "Saving…" : "Decline (full refund)"}
        </Button>
      </div>
    </div>
  );
}
