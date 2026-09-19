"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";

import { Button } from "@/components/consumer/ui/Button";
import { browserApi } from "@/lib/consumer/api/client";
import { ApiError } from "@/lib/consumer/api/envelope";
import type { EarlyJoinOffer } from "@/lib/consumer/api/types";
import { readyForNextPath } from "@/lib/consumer/features/consult";

function messageFor(result: EarlyJoinOffer): string {
  switch (result.status) {
    case "offered":
      return "Asked the next patient if they can join now.";
    case "already_offered":
      return "Already waiting on that patient's reply.";
    case "already_waiting":
      return "The next patient is already in the waiting room.";
    case "declined":
      return "The next patient asked to keep their booked time.";
    default:
      return "Ready for the next patient.";
  }
}

export function ReadyForNextButton({ appointmentId }: { appointmentId?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ping() {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const result = await browserApi<EarlyJoinOffer>(readyForNextPath(appointmentId), {
        method: "POST",
        body: {},
      });
      setNote(messageFor(result));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("No next patient waiting.");
      } else if (err instanceof ApiError && err.status === 409) {
        setError("Finish the current call first, then ask the next patient.");
      } else {
        setError(err instanceof Error ? err.message : "Could not notify the next patient");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="outline"
        busy={busy}
        leading={<BellRing className="size-4" />}
        onClick={() => void ping()}
      >
        Ready for next patient
      </Button>
      {note ? (
        <p role="status" className="text-body-sm text-muted">
          {note}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
