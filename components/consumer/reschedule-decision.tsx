"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/consumer/ui/Button";
import { Modal } from "@/components/consumer/ui/Modal";
import { browserApi } from "@/lib/consumer/api/client";
import type { RescheduleRequest } from "@/lib/consumer/api/types";

/**
 * Accepting a new time is ordinary, so it commits on the first click.
 * Declining cancels the visit and triggers a refund, which is the one
 * genuinely irreversible outcome on this screen -- so only that side gets a
 * confirmation dialog.
 */
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
  const [confirming, setConfirming] = useState(false);

  const from = request.original_start_at_local || request.original_start_at;
  const to = request.proposed_start_at_local || request.proposed_start_at;

  async function act(kind: "accept" | "decline") {
    setError(null);
    setBusy(kind);
    try {
      await browserApi(`/reschedule-requests/${request.id}/${kind}`, { method: "POST" });
      setConfirming(false);
      onChanged?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the request");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-warning-tint p-4">
      <p className="text-body-sm text-ink">
        The doctor asked to move this visit from <span className="font-semibold">{from}</span> to{" "}
        <span className="font-semibold">{to}</span>.
      </p>
      {request.reason ? <p className="text-body-sm text-muted">Reason: {request.reason}</p> : null}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" busy={busy === "accept"} disabled={busy !== null} onClick={() => void act("accept")}>
          Accept new time
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setConfirming(true)}>
          Decline
        </Button>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Decline the new time?"
        description={`This cancels the visit and refunds it in full. You would need to book again for another slot.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy !== null}>
              Keep deciding
            </Button>
            <Button
              variant="danger"
              busy={busy === "decline"}
              disabled={busy !== null}
              onClick={() => void act("decline")}
            >
              Decline and refund
            </Button>
          </>
        }
      />
    </div>
  );
}
