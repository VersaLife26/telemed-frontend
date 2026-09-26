"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { browserApi } from "@/lib/consumer/api/client";
import type {
  Consultation,
  ConsultationMessage,
  JoinResult,
  Paged,
  WaitingRoomStatus,
} from "@/lib/consumer/api/types";
import {
  admitDisabled,
  admitPath,
  consultationPath,
  consultJoinError,
  endConsultBody,
  endPath,
  hubUrlFor,
  isWaiting,
  joinPath,
  qualityLabel,
  qualityPath,
  type QualityLabel,
  QUALITY_REPORT_INTERVAL_MS,
  isConsultTerminal,
  shouldConnectMedia,
  waitingRoomPollPath,
} from "@/lib/consumer/features/consult";
import {
  consultationMessagesPath,
  createLiveChat,
  type ChatTransport,
} from "@/lib/consumer/features/chat";
import type { CallState } from "@/lib/webrtc/peer";
import { PeerCall } from "@/lib/webrtc/peer";
import { ROOM_REPLACED } from "@/lib/webrtc/signaling";
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

/** How often the lobby polls before the hub connection exists. */
const LOBBY_POLL_MS = 3_000;

/**
 * Join, admit, connect and end for one consultation.
 *
 * The hub connection is only opened with media, once the consultation is
 * active, because opening it earlier would let the two browsers negotiate
 * before the doctor admits. So the lobby polls (status, queue position), and
 * the live call relies on `state-changed` and `chat` frames instead.
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
  const joinedAt = useRef(0);
  // Set when this user opened the call elsewhere; blocks auto-reconnecting
  // back into the room, which would just bounce the other window out.
  const replacedRef = useRef(false);

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

  const chat = useMemo(() => {
    const live = createLiveChat(role, (body) => {
      if (!appointmentId) return;
      void browserApi<ConsultationMessage>(consultationMessagesPath(appointmentId), {
        method: "POST",
        body: { body },
      })
        .then((message) => live.merge([message]))
        .catch(() => setNotice("Your message wasn’t sent. Try again."));
    });
    return live;
  }, [appointmentId, role]);

  const loadMessages = useCallback(async () => {
    if (!appointmentId) return;
    try {
      const page = await browserApi<Paged<ConsultationMessage>>(
        `${consultationMessagesPath(appointmentId)}?page=1&pageSize=100`,
      );
      chat.merge(page.items);
    } catch {
      /* history is best effort; live messages still arrive over the hub */
    }
  }, [appointmentId, chat]);

  const freshSignalUrl = useCallback(async () => {
    if (!appointmentId) throw new Error("No consultation");
    const refreshed = await browserApi<JoinResult>(joinPath(appointmentId), { method: "POST" });
    return hubUrlFor(refreshed);
  }, [appointmentId]);

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

  const endLocally = useCallback(() => {
    leavingRef.current = true;
    stopPreview();
    callRef.current?.hangUp("consultation ended");
    callRef.current = null;
    setConnected(false);
    setConnecting(false);
  }, [stopPreview]);

  const applyConsultation = useCallback(
    (consult: Consultation) => {
      setStatus(consult.status);
      if (isConsultTerminal(consult.status)) endLocally();
    },
    [endLocally],
  );

  const connectMedia = useCallback(
    async (info: JoinResult) => {
      if (!appointmentId) return;
      setConnecting(true);
      setError(null);
      setNotice(null);
      stopPreview();
      try {
        callRef.current?.hangUp("reconnecting");

        const call = new PeerCall(hubUrlFor(info), {
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
          },
          onWelcome: () => void loadMessages(),
          onConsultation: applyConsultation,
          onMessage: (message) => chat.merge([message]),
          onRoomClosed: (reason) => {
            setConnected(false);
            setConnecting(false);
            if (reason === ROOM_REPLACED) {
              replacedRef.current = true;
              setHasLocalMedia(false);
              if (!leavingRef.current) setError("This call was opened in another window.");
              return;
            }
            void browserApi<Consultation>(consultationPath(appointmentId))
              .then(applyConsultation)
              .catch(() => {});
          },
          onPointer: (pointer) => setRemotePointer(pointer),
          onError: (_code, message) => setNotice(message),
          onQuality: (q) => {
            setQuality(qualityLabel(q));
            const now = Date.now();
            if (now - lastQualityReport.current < QUALITY_REPORT_INTERVAL_MS) return;
            lastQualityReport.current = now;
            void browserApi(qualityPath(appointmentId), {
              method: "POST",
              body: {
                quality: qualityLabel(q),
                packetLossPct: Math.round(q.packetLoss * 1000) / 10,
                bitrateKbps: Math.round(q.outboundKbps),
              },
            }).catch(() => {});
          },
        }, freshSignalUrl, joinedAt.current);
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
    [
      applyConsultation,
      appointmentId,
      attachLocal,
      cameraOff,
      chat,
      freshSignalUrl,
      loadMessages,
      muted,
      stopPreview,
    ],
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
    replacedRef.current = false;
    let cancelled = false;
    (async () => {
      try {
        const result = await browserApi<JoinResult>(joinPath(appointmentId), { method: "POST" });
        if (!cancelled) {
          joinedAt.current = Date.now();
          setJoin(result);
          setStatus(result.status);
          void loadMessages();
        }
      } catch (e) {
        if (!cancelled) setError(consultJoinError(e, role));
      }
    })();
    return () => {
      cancelled = true;
      leavingRef.current = true;
      stopPreview();
      callRef.current?.hangUp("left the page");
      callRef.current = null;
    };
  }, [appointmentId, chat, loadMessages, role, stopPreview]);

  useEffect(() => {
    if (isConsultTerminal(status)) return;
    if (!join || connected || connecting || replacedRef.current) return;
    if (shouldConnectMedia(join.status, status)) {
      void connectMedia(join);
    } else if (role === "patient" && isWaiting(status, join.status)) {
      void startPreview();
    }
  }, [join, status, connected, connecting, connectMedia, role, startPreview]);

  useEffect(() => {
    if (!appointmentId || !join || connected || isConsultTerminal(status)) return;
    let cancelled = false;
    async function tick() {
      try {
        const consult = await browserApi<Consultation>(consultationPath(appointmentId!));
        if (cancelled) return;
        applyConsultation(consult);
        if (isConsultTerminal(consult.status)) return;
        if (role === "patient") {
          const room = await browserApi<WaitingRoomStatus>(waitingRoomPollPath(appointmentId!));
          if (!cancelled) setQueue(room);
        }
      } catch {
        /* keep polling */
      }
    }
    void tick();
    const timer = window.setInterval(() => void tick(), LOBBY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyConsultation, appointmentId, connected, join, role, status]);

  const admit = useCallback(async () => {
    if (!appointmentId) return;
    setAdmitting(true);
    setError(null);
    try {
      const consult = await browserApi<Consultation>(admitPath(appointmentId), { method: "POST" });
      applyConsultation(consult);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Admit failed. The patient must join the waiting room first.",
      );
    } finally {
      setAdmitting(false);
    }
  }, [appointmentId, applyConsultation]);

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
    if (!appointmentId) return;
    setEnding(true);
    leavingRef.current = true;
    try {
      stopPreview();
      callRef.current?.hangUp("ended by this participant");
      // The server completes the appointment itself when the doctor ends.
      await browserApi(endPath(appointmentId), {
        method: "POST",
        body: endConsultBody(),
      });
    } catch {
      /* still leave the UI */
    } finally {
      setEnding(false);
      setConnected(false);
      setSharing(false);
      setScreenStream(null);
      setStatus("ended");
    }
  }, [appointmentId, stopPreview]);

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
    replacedRef.current = false;
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
    Array.isArray(join?.iceServers) &&
    !join.iceServers.some((s) => s.urls?.some((u) => u.startsWith("turn")));

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
    counterpartName: join?.counterpartName || "",
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
