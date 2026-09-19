"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { browserApi } from "@/lib/consumer/api/client";
import type { JoinResult, WaitingRoomStatus } from "@/lib/consumer/api/types";
import { callPath, joinPath, shouldEnterCall, waitingRoomPollPath } from "@/lib/consumer/features/consult";
import { formatWait } from "@/lib/consumer/money";

export function WaitingRoomClient({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [join, setJoin] = useState<JoinResult | null>(null);
  const [queue, setQueue] = useState<WaitingRoomStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await browserApi<JoinResult>(joinPath(appointmentId), {
          method: "POST",
        });
        if (!cancelled) setJoin(result);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not join. Pay for the appointment first so it is confirmed.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  useEffect(() => {
    if (!join?.consultation_id) return;
    if (shouldEnterCall(join.status)) {
      router.replace(callPath(appointmentId));
      return;
    }

    let cancelled = false;
    async function tick() {
      try {
        const [room, consult] = await Promise.all([
          browserApi<WaitingRoomStatus>(waitingRoomPollPath(join!.consultation_id)),
          browserApi<{ status?: string }>(`/consultations/${join!.consultation_id}`),
        ]);
        if (cancelled) return;
        setQueue(room);
        if (shouldEnterCall(join?.status, consult.status)) {
          router.replace(callPath(appointmentId));
        }
      } catch {
        /* keep polling */
      }
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [appointmentId, join, router]);

  function enterCall() {
    router.push(callPath(appointmentId));
  }

  const ahead = queue?.patients_ahead ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <h1 className="text-h2 text-ink">Waiting room</h1>

      {error ? (
        <Alert tone="danger" title="Couldn’t join">
          {error}
        </Alert>
      ) : join ? (
        <>
          {/* Queue position is the whole reason this screen exists, so it is
              the only thing on it rendered at display size. */}
          <div
            role="status"
            aria-live="polite"
            className="glass-panel flex flex-col items-center gap-2 p-8 text-center"
          >
            <p className="text-eyebrow text-brand">Your place in the queue</p>
            <p className="text-display text-ink tabular-time">#{queue?.position ?? 1}</p>
            <p className="text-body text-muted">
              {ahead
                ? `${ahead} ahead · about ${formatWait(queue?.estimated_wait_seconds)}`
                : "You are next"}
            </p>
          </div>

          <p className="text-body text-muted">
            Stay on this page — you are admitted automatically when the doctor is ready.
          </p>
          <p className="text-body-sm text-faint">Status: {join.status}</p>
        </>
      ) : (
        <div className="glass-panel p-8 text-center" role="status" aria-busy="true">
          <p className="text-body text-muted">Joining the waiting room…</p>
        </div>
      )}

      <Button size="lg" fullWidth onClick={enterCall} disabled={!join}>
        Enter call
      </Button>
    </div>
  );
}
