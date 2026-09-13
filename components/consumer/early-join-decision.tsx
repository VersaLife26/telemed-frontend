"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/consumer/ui/Button";
import { browserApi } from "@/lib/consumer/api/client";
import type { EarlyJoinOffer } from "@/lib/consumer/api/types";
import { earlyJoinRespondPath, waitingRoomPath } from "@/lib/consumer/features/consult";

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
      <div className="mt-3 rounded-[16px] bg-bg-gray px-4 py-3">
        <p className="text-body-sm text-black">
          You chose to join early. Head to the waiting room when you are ready.
        </p>
      </div>
    );
  }
  if (offer.response === "declined") {
    return (
      <div className="mt-3 rounded-[16px] bg-bg-gray px-4 py-3">
        <p className="text-body-sm text-text-muted">Keeping your original booked time.</p>
      </div>
    );
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
    <div className="mt-3 flex flex-col gap-2 rounded-[16px] bg-bg-gray px-4 py-3">
      <p className="text-body-sm text-black">
        The doctor is free a few minutes early. Can you join now, or keep your booked time?
      </p>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" fullWidth={false} disabled={busy !== null} onClick={() => void act("accept")}>
          {busy === "accept" ? "Joining…" : "Join now"}
        </Button>
        <Button
          type="button"
          variant="outline"
          fullWidth={false}
          disabled={busy !== null}
          onClick={() => void act("decline")}
        >
          {busy === "decline" ? "Saving…" : "Keep my booked time"}
        </Button>
      </div>
    </div>
  );
}
