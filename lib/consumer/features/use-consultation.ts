"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  type QualityLabel,
  QUALITY_REPORT_INTERVAL_MS,
  isConsultTerminal,
  shouldConnectMedia,
  signalUrlFor,
  waitingRoomPollPath,
} from "@/lib/consumer/features/consult";
import {
  consultationMessagesPath,
  createLiveChat,
  type ChatTransport,
  type ServerChatMessage,
} from "@/lib/consumer/features/chat";
import type { CallState } from "@/lib/webrtc/peer";
import { PeerCall, SIGNAL_ERROR } from "@/lib/webrtc/peer";
import type { PointerState } from "@/lib/consumer/features/pointer";

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
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** Your own screen capture while sharing, for the local preview. */
  screenStream: MediaStream | null;
  /** The last file the other participant said they added to the vault. */
  sharedFile: { name: string; at: number } | null;
  announceFile: (name: string) => void;
  quality: QualityLabel | null;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  admit: () => Promise<void>;
  end: () => Promise<void>;
  leave: () => void;
  retryMedia: () => Promise<void>;
  hasLocalMedia: boolean;
  chat: ChatTransport;
  pointing: boolean;
  localPointer: PointerState | null;
  remotePointer: PointerState | null;
  togglePointing: () => void;
  movePointer: (next: PointerState) => void;
  leavePointer: () => void;
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
  const callRef = useRef<PeerCall | null>(null);
  const previewRef = useRef<MediaStream | null>(null);
  const leavingRef = useRef(false);
  const lastQualityReport = useRef(0);
  const joinRef = useRef<JoinResult | null>(null);

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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [quality, setQuality] = useState<QualityLabel | null>(null);
  const [sharedFile, setSharedFile] = useState<{ name: string; at: number } | null>(null);
  const [ending, setEnding] = useState(false);
  const [admitting, setAdmitting] = useState(false);
  const [hasLocalMedia, setHasLocalMedia] = useState(false);
  const [pointing, setPointing] = useState(false);
  const [localPointer, setLocalPointer] = useState<PointerState | null>(null);
  const [remotePointer, setRemotePointer] = useState<PointerState | null>(null);
  const lastPointerSent = useRef(0);
  joinRef.current = join;

  const chat = useMemo(
    () =>
      createLiveChat((msg) => {
        callRef.current?.sendChat(msg);
        const cid = joinRef.current?.consultation_id;
        if (!cid) return;
        void browserApi(consultationMessagesPath(cid), {
          method: "POST",
          body: { content: msg.body, metadata: { client_id: msg.id } },
        }).catch(() => {});
      }),
    [appointmentId],
  );

  const stopPreview = useCallback(() => {
    const preview = previewRef.current;
    preview?.getTracks().forEach((track) => track.stop());
    previewRef.current = null;
    setLocalStream((current) => (current && current === preview ? null : current));
    setHasLocalMedia(false);
  }, []);

  const attachLocal = useCallback((stream: MediaStream | null) => {
    setLocalStream(stream);
    setHasLocalMedia(!!stream);
  }, []);

  const startPreview = useCallback(async () => {
    if (isConsultTerminal(status)) return;
    if (previewRef.current || callRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot access the camera. Use Chrome or Safari over HTTPS.");
      return;
    }
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
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? cameraMessage(e) : "Could not start the camera.");
    }
  }, [attachLocal, cameraOff, muted, status]);

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
          onRemoteStream: (stream) => setRemoteStream(stream),
          onScreenShareEnded: () => {
            setSharing(false);
            setScreenStream(null);
          },
          onFileShared: ({ name }) => setSharedFile({ name, at: Date.now() }),
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
          onChat: (msg) => chat.receive(msg),
          onPointer: (pointer) => setRemotePointer(pointer),
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
            setQuality(qualityLabel(q));
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
    [attachLocal, cameraOff, chat, muted, stopPreview],
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
      setHasLocalMedia(false);
      setPointing(false);
      setLocalPointer(null);
      setRemotePointer(null);
      setLocalStream(null);
      setRemoteStream(null);
      setScreenStream(null);
      setSharing(false);
      setSharedFile(null);
      chat.reset();
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
  }, [appointmentId, chat, stopPreview]);

  useEffect(() => {
    if (isConsultTerminal(status)) return;
    if (!join || connected || connecting) return;
    if (shouldConnectMedia(join.status, status)) {
      void connectMedia(join);
    } else if (role === "patient" && isWaiting(status, join.status)) {
      void startPreview();
    }
  }, [join, status, connected, connecting, connectMedia, role, startPreview]);

  useEffect(() => {
    if (!join?.consultation_id || isConsultTerminal(status)) return;
    let cancelled = false;
    async function tick() {
      try {
        const consult = await browserApi<Consultation>(`/consultations/${join!.consultation_id}`);
        if (cancelled) return;
        if (consult.status) {
          setStatus(consult.status);
          if (isConsultTerminal(consult.status)) {
            leavingRef.current = true;
            stopPreview();
            callRef.current?.hangUp("consultation ended");
            callRef.current = null;
            setConnected(false);
            setConnecting(false);
            return;
          }
        }
        if (!connected && (role === "patient" || consult.status === "waiting")) {
          const room = await browserApi<WaitingRoomStatus>(waitingRoomPollPath(join!.consultation_id));
          if (!cancelled) setQueue(room);
        }
        if (consult.status === "active" && join && !connected && !connecting) {
          void connectMedia(join);
        }
        const rows = await browserApi<ServerChatMessage[]>(
          `${consultationMessagesPath(join!.consultation_id)}?limit=100`,
        );
        if (!cancelled && Array.isArray(rows)) chat.mergeFromServer(rows, role);
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
  }, [chat, connectMedia, connected, connecting, join, role, status, stopPreview]);

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
    const call = callRef.current;
    if (!call) return;
    const next = !sharing;
    if (next && !navigator.mediaDevices?.getDisplayMedia) {
      setNotice("This browser can't share its screen. Try Chrome, Edge or Firefox on a computer.");
      return;
    }
    try {
      const stream = await call.setScreenShare(next);
      setSharing(Boolean(stream));
      setScreenStream(stream);
    } catch (e) {
      // Dismissing the browser's picker is a choice, not an error.
      if (e instanceof DOMException && e.name === "NotAllowedError") return;
      setNotice(e instanceof Error ? e.message : "Could not share the screen.");
    }
  }, [sharing]);

  const announceFile = useCallback((name: string) => {
    callRef.current?.sendFileShared(name);
  }, []);

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
      if (appointmentId) {
        await browserApi(`/appointments/${appointmentId}/complete`, {
          method: "POST",
        }).catch(() => {});
      }
    } catch {
      /* still leave the UI */
    } finally {
      setEnding(false);
      setConnected(false);
      setSharing(false);
      setScreenStream(null);
      setStatus("ended");
    }
  }, [join, stopPreview]);

  const leave = useCallback(() => {
    leavingRef.current = true;
    try {
      stopPreview();
      callRef.current?.hangUp("left by this participant");
    } finally {
      setConnected(false);
      setSharing(false);
      setScreenStream(null);
    }
  }, [stopPreview]);

  const retryMedia = useCallback(async () => {
    setError(null);
    if (join && shouldConnectMedia(join.status, status) && !connected) {
      await connectMedia(join);
      return;
    }
    await startPreview();
  }, [connectMedia, connected, join, startPreview, status]);

  const leavePointer = useCallback(() => {
    setLocalPointer((prev) => {
      const off: PointerState = prev
        ? { ...prev, active: false }
        : { x: 0, y: 0, active: false, surface: "video" };
      callRef.current?.sendPointer(off);
      return off;
    });
  }, []);

  const togglePointing = useCallback(() => {
    setPointing((on) => {
      if (on) {
        setLocalPointer((prev) => {
          const off: PointerState = prev
            ? { ...prev, active: false }
            : { x: 0, y: 0, active: false, surface: "video" };
          callRef.current?.sendPointer(off);
          return off;
        });
      }
      return !on;
    });
  }, []);

  const movePointer = useCallback((next: PointerState) => {
    setLocalPointer(next);
    const now = Date.now();
    if (now - lastPointerSent.current < 40 && next.active) return;
    lastPointerSent.current = now;
    callRef.current?.sendPointer(next);
  }, []);

  useEffect(() => {
    if (connected) return;
    setPointing(false);
    setLocalPointer(null);
    setRemotePointer(null);
    setQuality(null);
  }, [connected]);

  useEffect(() => {
    if (!pointing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") togglePointing();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pointing, togglePointing]);

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
    localStream,
    remoteStream,
    screenStream,
    sharedFile,
    announceFile,
    quality,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    admit,
    end,
    leave,
    retryMedia,
    hasLocalMedia,
    chat,
    pointing,
    localPointer,
    remotePointer,
    togglePointing,
    movePointer,
    leavePointer,
  };
}

export function admitIsDisabled(status?: string): boolean {
  return admitDisabled(status);
}

function cameraMessage(e: Error): string {
  switch (e.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera and microphone need permission. Allow them when the browser asks, then try again.";
    case "NotFoundError":
      return "No camera or microphone was found on this device.";
    case "NotReadableError":
      return "Your camera is already in use by another application.";
    default:
      return e.message || "Could not start the call.";
  }
}
