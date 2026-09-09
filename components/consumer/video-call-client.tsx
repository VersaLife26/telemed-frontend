"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { browserApi } from "@/lib/consumer/api/client";
import type { Consultation, JoinResult, WaitingRoomStatus } from "@/lib/consumer/api/types";
import {
  admitDisabled,
  admitPath,
  endConsultBody,
  endPath,
  isWaiting,
  joinPath,
  shouldConnectMedia,
  waitingRoomPollPath,
} from "@/lib/consumer/features/consult";
import { formatWait } from "@/lib/consumer/money";

type Role = "patient" | "doctor";

export function VideoCallClient({
  appointmentId,
  role,
  afterEndHref,
}: {
  appointmentId: string;
  role: Role;
  afterEndHref: string;
}) {
  const router = useRouter();
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<{ disconnect: () => Promise<void> } | null>(null);

  const [join, setJoin] = useState<JoinResult | null>(null);
  const [queue, setQueue] = useState<WaitingRoomStatus | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [ending, setEnding] = useState(false);
  const [admitting, setAdmitting] = useState(false);

  const connectMedia = useCallback(async (info: JoinResult) => {
    setConnecting(true);
    setError(null);
    try {
      const { Room, RoomEvent, Track } = await import("livekit-client");
      await roomRef.current?.disconnect();
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && remoteRef.current) {
          track.attach(remoteRef.current);
        } else if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.autoplay = true;
          document.body.appendChild(el);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
      });
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false);
      });

      await room.connect(info.livekit_url, info.token);
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);
      const cam = [...room.localParticipant.videoTrackPublications.values()][0];
      if (cam?.track && localRef.current) {
        cam.track.attach(localRef.current);
      }
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to LiveKit");
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await browserApi<JoinResult>(joinPath(appointmentId), {
          method: "POST",
        });
        if (!cancelled) {
          setJoin(result);
          setStatus(result.status);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Join failed");
        }
      }
    })();
    return () => {
      cancelled = true;
      void roomRef.current?.disconnect();
    };
  }, [appointmentId]);

  useEffect(() => {
    if (!join || connected || connecting) return;
    if (shouldConnectMedia(join.status, status)) {
      void connectMedia(join);
    }
  }, [join, status, connected, connecting, connectMedia]);

  useEffect(() => {
    if (!join?.consultation_id) return;
    let cancelled = false;
    async function tick() {
      try {
        const consult = await browserApi<Consultation>(
          `/consultations/${join!.consultation_id}`,
        );
        if (cancelled) return;
        if (consult.status) setStatus(consult.status);
        if (!connected && (role === "patient" || consult.status === "waiting")) {
          const room = await browserApi<WaitingRoomStatus>(
            waitingRoomPollPath(join!.consultation_id),
          );
          if (!cancelled) setQueue(room);
        }
        if (consult.status === "active" && join && !connected && !connecting) {
          void connectMedia(join);
        }
        if (consult.status === "ended" || consult.status === "abandoned") {
          await roomRef.current?.disconnect();
          router.replace(afterEndHref);
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
  }, [afterEndHref, connectMedia, connected, connecting, join, role, router]);

  async function admit() {
    if (!join?.consultation_id) return;
    setAdmitting(true);
    setError(null);
    try {
      await browserApi(admitPath(join.consultation_id), {
        method: "POST",
        body: {},
      });
      const refreshed = await browserApi<JoinResult>(joinPath(appointmentId), {
        method: "POST",
      });
      setJoin(refreshed);
      setStatus(refreshed.status);
      await connectMedia(refreshed);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Admit failed. The patient must join the waiting room first.",
      );
    } finally {
      setAdmitting(false);
    }
  }

  async function toggleMute() {
    const room = roomRef.current as { localParticipant?: { setMicrophoneEnabled: (v: boolean) => Promise<void> } } | null;
    if (!room?.localParticipant) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }

  async function toggleCamera() {
    const room = roomRef.current as { localParticipant?: { setCameraEnabled: (v: boolean) => Promise<void> } } | null;
    if (!room?.localParticipant) return;
    const next = !cameraOff;
    await room.localParticipant.setCameraEnabled(!next);
    setCameraOff(next);
  }

  async function endCall() {
    if (!join?.consultation_id) return;
    setEnding(true);
    try {
      await roomRef.current?.disconnect();
      await browserApi(endPath(join.consultation_id), {
        method: "POST",
        body: endConsultBody(),
      });
    } catch {
      /* still leave the UI */
    } finally {
      router.push(afterEndHref);
    }
  }

  const waiting = isWaiting(status, join?.status);
  const live = connected || status === "active";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="relative overflow-hidden rounded-[16px] bg-black aspect-video">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
        <video
          ref={localRef}
          autoPlay
          muted
          playsInline
          className="absolute bottom-3 right-3 h-28 w-40 rounded-[12px] border-2 border-white object-cover"
        />
        {!live ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 p-6 text-center">
            <p className="text-h4 text-white">
              {connecting ? "Connecting…" : waiting ? "Waiting room" : "Video call"}
            </p>
            {role === "patient" && waiting ? (
              <p className="text-body-sm text-white/80">
                Position #{queue?.position ?? "—"} · {formatWait(queue?.estimated_wait_seconds)}
              </p>
            ) : null}
            {role === "doctor" && status === "scheduled" ? (
              <p className="text-body-sm text-white/80">Waiting for the patient to join.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <Card>
          <p className="text-body-sm text-danger">{error}</p>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {role === "doctor" && waiting && status !== "active" ? (
          <div className="min-w-[160px]">
            <Button type="button" fullWidth={false} onClick={() => void admit()} disabled={admitting || admitDisabled(status)}>
              {admitting ? "Admitting…" : "Admit patient"}
            </Button>
          </div>
        ) : null}
        {live ? (
          <>
            <div className="min-w-[140px]">
              <Button type="button" variant="secondary" fullWidth={false} onClick={() => void toggleMute()}>
                {muted ? "Unmute" : "Mute"}
              </Button>
            </div>
            <div className="min-w-[140px]">
              <Button type="button" variant="secondary" fullWidth={false} onClick={() => void toggleCamera()}>
                {cameraOff ? "Camera on" : "Camera off"}
              </Button>
            </div>
            <div className="min-w-[140px]">
              <Button type="button" fullWidth={false} onClick={() => void endCall()} disabled={ending}>
                {ending ? "Ending…" : "End call"}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
