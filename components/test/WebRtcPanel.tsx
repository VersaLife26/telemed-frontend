"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PeerCall, type CallQuality, type CallState } from "@/lib/webrtc/peer";
import { createRoom, signalUrl, type RoomGrant } from "@/lib/test/api";

/**
 * Drives a real two-party call against the real signalling server.
 *
 * Two browser contexts join the same room name with different identities. The
 * usual way to run it is this page in two tabs, or a laptop and a phone -- from
 * a phone, NEXT_PUBLIC_API_BASE_URL has to be the machine's LAN address, since
 * the websocket connects to the backend directly rather than through Next.
 */
export function WebRtcPanel() {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const callRef = useRef<PeerCall | null>(null);

  const [room, setRoom] = useState("");
  const [identity, setIdentity] = useState("");
  const [grant, setGrant] = useState<RoomGrant | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [quality, setQuality] = useState<CallQuality | null>(null);
  const [remoteQuality, setRemoteQuality] = useState<CallQuality | null>(null);
  const [remoteRecording, setRemoteRecording] = useState(false);
  const [recording, setRecording] = useState(false);
  const [download, setDownload] = useState<{ url: string; size: number } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);

  // The room name is prefilled from ?room= so the second device can join by
  // scanning or pasting the URL rather than retyping a name exactly.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRoom(params.get("room") ?? `room-${Math.random().toString(36).slice(2, 8)}`);
    setIdentity(params.get("identity") ?? `peer-${Math.random().toString(36).slice(2, 6)}`);
  }, []);

  const append = useCallback((line: string) => {
    const stamp = new Date().toLocaleTimeString();
    setLog((prev) => [`${stamp}  ${line}`, ...prev].slice(0, 200));
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setDownload(null);
    try {
      const g = await createRoom(room, identity);
      setGrant(g);
      append(`room ${g.room} as ${g.identity}; ${g.ice_servers.length} ICE server(s)`);

      const call = new PeerCall(signalUrl(g), {
        onStateChange: (s) => {
          setState(s);
          append(`call ${s}`);
        },
        onRemoteStream: (stream) => {
          if (remoteRef.current) remoteRef.current.srcObject = stream;
        },
        onQuality: setQuality,
        onRemoteQuality: setRemoteQuality,
        onRemoteRecording: setRemoteRecording,
        onLog: append,
      });
      callRef.current = call;

      const local = await call.start();
      if (localRef.current) localRef.current.srcObject = local;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      append(`start failed: ${message}`);
    }
  }, [append, identity, room]);

  const hangUp = useCallback(() => {
    callRef.current?.hangUp("hung up from the test page");
    callRef.current = null;
    setQuality(null);
    setRemoteQuality(null);
  }, []);

  // Releases the camera when the tab closes or the component unmounts. Without
  // it the camera light stays on after navigating away, which is alarming on a
  // page that a developer opens and closes dozens of times.
  useEffect(() => {
    return () => {
      callRef.current?.hangUp("page closed");
      callRef.current = null;
    };
  }, []);

  async function toggleRecording() {
    const call = callRef.current;
    if (!call) return;
    if (call.recording) {
      const blob = await call.stopRecording();
      setRecording(false);
      if (blob) {
        setDownload({ url: URL.createObjectURL(blob), size: blob.size });
        append(`recording stopped, ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
      }
      return;
    }
    if (call.startRecording()) setRecording(true);
  }

  async function toggleShare() {
    const call = callRef.current;
    if (!call) return;
    try {
      await call.setScreenShare(!sharing);
      setSharing(!sharing);
    } catch (e) {
      append(`screen share failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const live = state === "connected" || state === "reconnecting";
  const shareUrl =
    typeof window !== "undefined" && grant
      ? `${window.location.origin}/test?tab=webrtc&room=${encodeURIComponent(grant.room)}`
      : "";

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Room</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Room name
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              disabled={state !== "idle" && state !== "ended"}
              className="w-56 rounded border border-neutral-300 px-2 py-1.5 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Identity
            <input
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              disabled={state !== "idle" && state !== "ended"}
              className="w-44 rounded border border-neutral-300 px-2 py-1.5 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-800"
            />
          </label>
          {state === "idle" || state === "ended" ? (
            <button
              type="button"
              onClick={() => void start()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Join call
            </button>
          ) : (
            <button
              type="button"
              onClick={hangUp}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Hang up
            </button>
          )}
          <StatePill state={state} />
        </div>

        {shareUrl ? (
          <p className="mt-3 break-all text-xs text-neutral-500">
            Open on the second device:{" "}
            <span className="font-mono text-neutral-700 dark:text-neutral-300">{shareUrl}</span>
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <VideoTile label="You" videoRef={localRef} muted badge={sharing ? "sharing screen" : undefined} />
        <VideoTile
          label="Them"
          videoRef={remoteRef}
          badge={remoteRecording ? "recording you" : undefined}
        />
      </section>

      {live ? (
        <section className="flex flex-wrap gap-2">
          <ControlButton
            active={micOn}
            onClick={() => {
              callRef.current?.setMicrophoneEnabled(!micOn);
              setMicOn(!micOn);
            }}
          >
            {micOn ? "Mute" : "Unmute"}
          </ControlButton>
          <ControlButton
            active={camOn}
            onClick={() => {
              callRef.current?.setCameraEnabled(!camOn);
              setCamOn(!camOn);
            }}
          >
            {camOn ? "Camera off" : "Camera on"}
          </ControlButton>
          <ControlButton active={sharing} onClick={() => void toggleShare()}>
            {sharing ? "Stop sharing" : "Share screen"}
          </ControlButton>
          <ControlButton active={recording} onClick={() => void toggleRecording()}>
            {recording ? "Stop recording" : "Record locally"}
          </ControlButton>
        </section>
      ) : null}

      {download ? (
        <p className="text-sm">
          <a
            href={download.url}
            download={`consultation-${room}.webm`}
            className="text-blue-600 underline"
          >
            Download recording ({(download.size / 1024 / 1024).toFixed(1)} MB)
          </a>
          <span className="ml-2 text-xs text-neutral-500">
            Recorded in this browser only — a peer-to-peer call has no server in the media path.
          </span>
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <QualityCard title="Your link" q={quality} />
        <QualityCard title="Their link" q={remoteQuality} />
      </section>

      {quality && !quality.relayed && state === "connected" ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This call is running peer-to-peer with no TURN relay. That is the good case — but it also
          means this test has not exercised the relay path, which is what real users behind mobile
          carrier NAT will depend on.
        </p>
      ) : null}

      <section className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Log</h2>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          {log.length > 0 ? log.join("\n") : "nothing yet"}
        </pre>
      </section>
    </div>
  );
}

function VideoTile({
  label,
  videoRef,
  muted,
  badge,
}: {
  label: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  muted?: boolean;
  badge?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "16 / 9" }}>
      <video ref={videoRef} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {label}
      </span>
      {badge ? (
        <span className="absolute right-2 top-2 rounded bg-red-600 px-2 py-0.5 text-xs text-white">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function StatePill({ state }: { state: CallState }) {
  const tone: Record<CallState, string> = {
    idle: "bg-neutral-200 text-neutral-700",
    "waiting-for-peer": "bg-amber-200 text-amber-900",
    connecting: "bg-amber-200 text-amber-900",
    connected: "bg-green-200 text-green-900",
    reconnecting: "bg-amber-300 text-amber-950",
    failed: "bg-red-200 text-red-900",
    ended: "bg-neutral-200 text-neutral-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone[state]}`}>{state}</span>;
}

function ControlButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-3 py-1.5 text-sm ${
        active
          ? "border-neutral-300 bg-white text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          : "border-neutral-400 bg-neutral-200 text-neutral-700 dark:border-neutral-500 dark:bg-neutral-700 dark:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

function QualityCard({ title, q }: { title: string; q: CallQuality | null }) {
  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {!q ? (
        <p className="text-xs text-neutral-500">no samples yet</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
          <Row k="rtt" v={q.rttMs === null ? "—" : `${Math.round(q.rttMs)} ms`} />
          <Row k="loss" v={`${(q.packetLoss * 100).toFixed(1)}%`} />
          <Row k="out" v={`${q.outboundKbps} kbps`} />
          <Row k="in" v={`${q.inboundKbps} kbps`} />
          <Row k="target" v={`${q.targetKbps} kbps`} />
          <Row
            k="size"
            v={q.frameWidth && q.frameHeight ? `${q.frameWidth}x${q.frameHeight}` : "—"}
          />
          <Row k="path" v={q.relayed ? "TURN relay" : "direct"} />
        </dl>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-neutral-800 dark:text-neutral-200">{v}</dd>
    </>
  );
}
