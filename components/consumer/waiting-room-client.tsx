"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/consumer/layout/AppShell";
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

  return (
    <Card className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-h4 text-black">Waiting room</h1>
      {error ? (
        <p className="text-body-sm text-danger">{error}</p>
      ) : join ? (
        <>
          <p className="text-body text-text-muted">
            You are in the queue. The doctor will admit you when ready.
          </p>
          <div className="rounded-[16px] bg-white p-4">
            <p className="text-h2 text-primary">#{queue?.position ?? 1}</p>
            <p className="text-body-sm text-text-muted">
              {queue?.patients_ahead
                ? `${queue.patients_ahead} ahead · ${formatWait(queue.estimated_wait_seconds)}`
                : "You are next"}
            </p>
          </div>
          <p className="text-body-sm text-text-muted">Status: {join.status}</p>
        </>
      ) : (
        <p className="text-body text-text-muted">Joining the waiting room…</p>
      )}
      <Button type="button" onClick={enterCall} disabled={!join}>
        Enter call
      </Button>
    </Card>
  );
}
