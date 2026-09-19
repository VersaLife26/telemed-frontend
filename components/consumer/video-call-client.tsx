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
  qualityLabel,
  qualityPath,
  QUALITY_REPORT_INTERVAL_MS,
  shouldConnectMedia,
  signalUrlFor,
  waitingRoomPollPath,
} from "@/lib/consumer/features/consult";
import { formatWait } from "@/lib/consumer/money";
import type { CallState } from "@/lib/webrtc/peer";
import { PeerCall, SIGNAL_ERROR } from "@/lib/webrtc/peer";

type Role = "patient" | "doctor";

/**
 * The consultation call screen.
 *
 * SINGLE PATH, ON PURPOSE
 * This talks only to the platform's own WebRTC stack. There is no
 * `provider === "livekit"` branch, and adding one would double the surface of
 * the least-testable screen in the app for a rollback that is a server-side
 * config flip -- and one that needs a frontend deploy anyway, since the
 * LiveKit SDK is no longer bundled.
 *
 * WHAT IS DIFFERENT FROM AN SFU CLIENT
 * Three states are reachable here that were not before, and each is rendered
 * rather than left as an indefinite "Connecting…":
 *
 *   - The room is full. A third tab is refused AFTER the socket opens, as an
 *     error frame, because a client that sees a socket open and then close
 *     with no explanation cannot tell "room full" from "server down".
 *   - The call was opened elsewhere. Rejoining under the same identity
 *     REPLACES the previous peer -- that is what makes reconnection work at
 *     all -- so a doctor opening a second tab silently kills the first.
 *   - No TURN relay. On a peer-to-peer call that is not a degradation, it is
 *     the difference between connecting and not for anyone behind carrier-
 *     grade NAT.
 */
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
  const callRef = useRef<PeerCall | null>(null);
  // Set when this tab deliberately tears the call down, so the "opened
  // elsewhere" notice is not shown for our own hang-up.
  const leavingRef = useRef(false);

  const [join, setJoin] = useState<JoinResult | null>(null);
  const [queue, setQueue] = useState<WaitingRoomStatus | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [ending, setEnding] = useState(false);
  const [admitting, setAdmitting] = useState(false);

  // Throttles quality reporting. peer.ts samples every 2s for its own bitrate
  // ladder; the server only needs enough to make its consecutive-poor counter
  // meaningful.
  const lastQualityReport = useRef(0);

  const connectMedia = useCallback(async (info: JoinResult) => {
    const url = signalUrlFor(info);
    if (!url) {
      setError(
        "This deployment is not configured for video calls. Nobody can join until " +
          "the signalling address is set.",
      );
      return;
    }

    setConnecting(true);
    setError(null);
    setNotice(null);
    try {
      // Tear down any previous call first: PeerCall owns a camera, and two of
      // them would leave the old one holding the device.
      callRef.current?.hangUp("reconnecting");

      // Handlers are constructor-only, so everything this screen reacts to
      // has to be supplied up front.
      const call = new PeerCall(url, {
        onRemoteStream: (stream) => {
          if (remoteRef.current) remoteRef.current.srcObject = stream;
        },
        onStateChange: (state: CallState) => {
          setConnected(state === "connected");
          if (state === "connected") {
            setConnecting(false);
            setNotice(null);
          }
          if (state === "reconnecting") {
            setNotice("Connection lost. Reconnecting…");
          }
          if (state === "failed") {
            setError(
              "The connection failed. If you are on mobile data this can mean no relay " +
                "was available — try switching to wifi.",
            );
            setConnecting(false);
          }
          if (state === "ended" && !leavingRef.current) {
            // The hub closed us. Either the room was ended server-side or this
            // identity rejoined from somewhere else.
            setNotice("This call was opened in another window.");
          }
        },
        onError: (code, message) => {
          if (code === SIGNAL_ERROR.roomFull) {
            // Refused after a successful upgrade, which is why it arrives here
            // rather than as a failed connection. Two people are already in
            // this consultation.
            setConnecting(false);
            setError(
              "This consultation already has two participants. If you have it open in " +
                "another tab or on another device, close that one first.",
            );
            return;
          }
          setNotice(message);
        },
        onQuality: (q) => {
          const id = info.consultation_id;
          if (!id) return;
          const now = Date.now();
          if (now - lastQualityReport.current < QUALITY_REPORT_INTERVAL_MS) return;
          lastQualityReport.current = now;
          // Fire-and-forget: a failed quality report must never disturb a
          // call that is otherwise working.
          void browserApi(qualityPath(id), {
            method: "POST",
            body: {
              quality: qualityLabel(q),
              packet_loss_pct: Math.round(q.packetLoss * 1000) / 10,
              bitrate_kbps: Math.round(q.outboundKbps),
            },
          }).catch(() => {});
        },
      });
      callRef.current = call;
      leavingRef.current = false;

      // start() resolves once the CAMERA is acquired, not once the peer is
      // connected -- that arrives later via onStateChange. The old LiveKit
      // room.connect() awaited the whole thing, so this is the one shape
      // change to be careful about.
      const localStream = await call.start();
      if (localRef.current) localRef.current.srcObject = localStream;
    } catch (e) {
      setConnecting(false);
      setError(
        e instanceof Error
          ? cameraMessage(e)
          : "Could not start the call.",
      );
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
      leavingRef.current = true;
      callRef.current?.hangUp("left the page");
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
          leavingRef.current = true;
          callRef.current?.hangUp("consultation ended");
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

  // Synchronous now: PeerCall toggles track.enabled rather than renegotiating.
  function toggleMute() {
    const next = !muted;
    callRef.current?.setMicrophoneEnabled(!next);
    setMuted(next);
  }

  function toggleCamera() {
    const next = !cameraOff;
    callRef.current?.setCameraEnabled(!next);
    setCameraOff(next);
  }

  async function endCall() {
    if (!join?.consultation_id) return;
    setEnding(true);
    leavingRef.current = true;
    try {
      callRef.current?.hangUp("ended by this participant");
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
  // A peer-to-peer call with no relay connects fine on a LAN and fails behind
  // carrier-grade NAT, which is most Sri Lankan mobile data. Worth saying
  // before the camera comes on rather than after the call does not connect.
  const noRelay =
    join?.provider === "inhouse" &&
    Array.isArray(join.ice_servers) &&
    !join.ice_servers.some((s) => s.urls?.some((u) => u.startsWith("turn")));

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
              <p className="text-body-sm text-white/80">
                Waiting for the patient to join. The booked slot is the visit window.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {notice ? (
        <Card>
          <p className="text-body-sm">{notice}</p>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <p className="text-body-sm text-danger">{error}</p>
        </Card>
      ) : null}

      {noRelay && !live ? (
        <Card>
          <p className="text-body-sm text-white/80">
            No relay server is configured. The call may not connect on mobile data.
          </p>
        </Card>
      ) : null}

      {live && join?.recording_mode === "client" ? (
        <Card>
          <p className="text-body-sm">
            Any recording of this consultation is saved on the doctor&rsquo;s device, not
            by the platform.
          </p>
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
              <Button type="button" variant="secondary" fullWidth={false} onClick={toggleMute}>
                {muted ? "Unmute" : "Mute"}
              </Button>
            </div>
            <div className="min-w-[140px]">
              <Button type="button" variant="secondary" fullWidth={false} onClick={toggleCamera}>
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

/**
 * getUserMedia's errors are the ones a patient actually hits, and its native
 * messages ("Requested device not found") do not tell them what to do.
 */
function cameraMessage(e: Error): string {
  switch (e.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera and microphone access was blocked. Allow it in your browser and reload.";
    case "NotFoundError":
      return "No camera or microphone was found on this device.";
    case "NotReadableError":
      return "Your camera is already in use by another application.";
    default:
      return e.message || "Could not start the call.";
  }
}
