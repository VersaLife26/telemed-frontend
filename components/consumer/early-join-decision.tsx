"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { browserApi } from "@/lib/consumer/api/client";
import type { EarlyJoinOffer } from "@/lib/consumer/api/types";
import { earlyJoinRespondPath, waitingRoomPath } from "@/lib/consumer/features/consult";

/**
 * Both answers here are cheap and reversible-ish, so neither gets a
 * confirmation step -- a dialog on a low-stakes choice just trains people to
 * dismiss dialogs.
 */
export function EarlyJoinDecision({
  offer,
  onChanged,
}: {
  offer: EarlyJoinOffer;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  if (offer.response === "accepted") {
    return (
      <Alert tone="success" title="Joining early">
        Head to the waiting room when you are ready.
      </Alert>
    );
  }
  if (offer.response === "declined") {
    return <Alert tone="info">Keeping your original booked time.</Alert>;
  }

  async function act(kind: "accept" | "decline") {
    setError(null);
    setBusy(kind);
    try {
      await browserApi(earlyJoinRespondPath(offer.appointment_id, kind), {
        method: "POST",
        body: {},
      });
      if (kind === "accept") {
        router.push(waitingRoomPath(offer.appointment_id));
        return;
      }
      onChanged?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the offer");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-brand-tint p-4">
      <p className="text-body-sm text-ink">
        The doctor is free a few minutes early. Can you join now, or keep your booked time?
      </p>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" busy={busy === "accept"} disabled={busy !== null} onClick={() => void act("accept")}>
          Join now
        </Button>
        <Button
          size="sm"
          variant="outline"
          busy={busy === "decline"}
          disabled={busy !== null}
          onClick={() => void act("decline")}
        >
          Keep my booked time
        </Button>
      </div>
    </div>
  );
}
