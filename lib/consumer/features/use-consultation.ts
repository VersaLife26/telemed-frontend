"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
import type { CallState } from "@/lib/webrtc/peer";
import { PeerCall, SIGNAL_ERROR } from "@/lib/webrtc/peer";

export type ConsultationRole = "patient" | "doctor";

export type ConsultationControls = {
  join: JoinResult | null;
  status: string;
  queue: WaitingRoomStatus | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  notice: string | null;
  muted: boolean;
  cameraOff: boolean;
  sharing: boolean;
  admitting: boolean;
  ending: boolean;
  waiting: boolean;
  live: boolean;
  noRelay: boolean;
  counterpartName: string;
  localRef: React.RefObject<HTMLVideoElement | null>;
  remoteRef: React.RefObject<HTMLVideoElement | null>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  admit: () => Promise<void>;
  end: () => Promise<void>;
};

/**
 * Join, poll, admit, connect and end for one consultation.
 *
 * Both the patient call screen and the doctor workspace consume this, so the
 * call logic lives in one place. `appointmentId` null is a quiet idle state
 * used by the workspace when no call is open.
 */
export function useConsultation(
  appointmentId: string | null,
  role: ConsultationRole,
): ConsultationControls {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const callRef = useRef<PeerCall | null>(null);
  const previewRef = useRef<MediaStream | null>(null);
  const leavingRef = useRef(false);
  const lastQualityReport = useRef(0);

  const [join, setJoin] = useState<JoinResult | null>(null);
  const [queue, setQueue] = useState<WaitingRoomStatus | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [admitting, setAdmitting] = useState(false);

  const stopPreview = useCallback(() => {
    previewRef.current?.getTracks().forEach((track) => track.stop());
    previewRef.current = null;
  }, []);

  const attachLocal = useCallback((stream: MediaStream | null) => {
    if (localRef.current) localRef.current.srcObject = stream;
  }, []);

  const startPreview = useCallback(async () => {
    if (previewRef.current || callRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      previewRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !cameraOff;
      });
      attachLocal(stream);
    } catch (e) {
      setError(e instanceof Error ? cameraMessage(e) : "Could not start the camera.");
    }
  }, [attachLocal, cameraOff, muted]);

  const connectMedia = useCallback(
    async (info: JoinResult) => {
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
      stopPreview();
      try {
        callRef.current?.hangUp("reconnecting");

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
              setNotice("This call was opened in another window.");
            }
          },
          onError: (code, message) => {
            if (code === SIGNAL_ERROR.roomFull) {
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

        const localStream = await call.start();
        call.setMicrophoneEnabled(!muted);
        call.setCameraEnabled(!cameraOff);
        attachLocal(localStream);
      } catch (e) {
        setConnecting(false);
        setError(e instanceof Error ? cameraMessage(e) : "Could not start the call.");
      }
    },
    [attachLocal, cameraOff, muted, stopPreview],
  );

  useEffect(() => {
    if (!appointmentId) {
      setJoin(null);
      setStatus("");
      setQueue(null);
      setError(null);
      setNotice(null);
      setConnected(false);
      setConnecting(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await browserApi<JoinResult>(joinPath(appointmentId), { method: "POST" });
        if (!cancelled) {
          setJoin(result);
          setStatus(result.status);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Join failed");
      }
    })();
    return () => {
      cancelled = true;
      leavingRef.current = true;
      stopPreview();
      callRef.current?.hangUp("left the page");
      callRef.current = null;
    };
  }, [appointmentId, stopPreview]);

  useEffect(() => {
    if (!join || connected || connecting) return;
    if (shouldConnectMedia(join.status, status)) {
      void connectMedia(join);
    } else if (role === "patient" && isWaiting(status, join.status)) {
      void startPreview();
    }
  }, [join, status, connected, connecting, connectMedia, role, startPreview]);

  useEffect(() => {
    if (!join?.consultation_id) return;
    let cancelled = false;
    async function tick() {
      try {
        const consult = await browserApi<Consultation>(`/consultations/${join!.consultation_id}`);
        if (cancelled) return;
        if (consult.status) setStatus(consult.status);
        if (!connected && (role === "patient" || consult.status === "waiting")) {
          const room = await browserApi<WaitingRoomStatus>(waitingRoomPollPath(join!.consultation_id));
          if (!cancelled) setQueue(room);
        }
        if (consult.status === "active" && join && !connected && !connecting) {
          void connectMedia(join);
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
  }, [connectMedia, connected, connecting, join, role]);

  const admit = useCallback(async () => {
    if (!join?.consultation_id || !appointmentId) return;
    setAdmitting(true);
    setError(null);
    try {
      await browserApi(admitPath(join.consultation_id), { method: "POST", body: {} });
      const refreshed = await browserApi<JoinResult>(joinPath(appointmentId), { method: "POST" });
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
  }, [appointmentId, connectMedia, join]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    previewRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    callRef.current?.setMicrophoneEnabled(!next);
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOff;
    previewRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    callRef.current?.setCameraEnabled(!next);
    setCameraOff(next);
  }, [cameraOff]);

  const toggleScreenShare = useCallback(async () => {
    const next = !sharing;
    try {
      await callRef.current?.setScreenShare(next);
      setSharing(next);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not share the screen.");
    }
  }, [sharing]);

  const end = useCallback(async () => {
    if (!join?.consultation_id) return;
    setEnding(true);
    leavingRef.current = true;
    try {
      stopPreview();
      callRef.current?.hangUp("ended by this participant");
      await browserApi(endPath(join.consultation_id), {
        method: "POST",
        body: endConsultBody(),
      });
    } catch {
      /* still leave the UI */
    } finally {
      setEnding(false);
      setConnected(false);
      setStatus("ended");
    }
  }, [join, stopPreview]);

  const waiting = isWaiting(status, join?.status);
  const live = connected || status === "active";
  const noRelay =
    join?.provider === "inhouse" &&
    Array.isArray(join.ice_servers) &&
    !join.ice_servers.some((s) => s.urls?.some((u) => u.startsWith("turn")));

  return {
    join,
    status,
    queue,
    connected,
    connecting,
    error,
    notice,
    muted,
    cameraOff,
    sharing,
    admitting,
    ending,
    waiting,
    live,
    noRelay,
    counterpartName: join?.counterpart_name || "",
    localRef,
    remoteRef,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    admit,
    end,
  };
}

export function admitIsDisabled(status?: string): boolean {
  return admitDisabled(status);
}

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
