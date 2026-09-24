"use client";

import { MousePointer2 } from "lucide-react";

import { StreamVideo } from "@/components/consumer/call/stream-video";
import type { PointerState } from "@/lib/consumer/features/pointer";
import { pointerFromEvent, pointerMatches } from "@/lib/consumer/features/pointer";
import { cx } from "@/lib/consumer/cx";

export function PointerLayer({
  pointing,
  local,
  remote,
  surface,
  fileId,
  onMove,
  onLeave,
  className,
  incomingLabel,
}: {
  pointing: boolean;
  local: PointerState | null;
  remote: PointerState | null;
  surface: "video" | "file";
  fileId?: string;
  onMove: (next: PointerState) => void;
  onLeave: () => void;
  className?: string;
  incomingLabel?: string;
}) {
  const showRemote = pointerMatches(remote, surface, fileId);
  const showLocal = pointing && pointerMatches(local, surface, fileId);

  return (
    <div
      className={cx("absolute inset-0 z-20", pointing ? "cursor-crosshair touch-none" : "pointer-events-none", className)}
      onPointerMove={(event) => {
        if (!pointing) return;
        const next = pointerFromEvent(event, surface, fileId);
        if (next) onMove(next);
      }}
      onPointerDown={(event) => {
        if (!pointing) return;
        const next = pointerFromEvent(event, surface, fileId);
        if (next) onMove(next);
      }}
      onPointerLeave={() => {
        if (pointing) onLeave();
      }}
    >
      {showRemote && remote ? (
        <PointerDot x={remote.x} y={remote.y} tone="incoming" label={incomingLabel || "Pointing"} />
      ) : null}
      {showLocal && local ? <PointerDot x={local.x} y={local.y} tone="self" label="You" /> : null}
    </div>
  );
}

function PointerDot({
  x,
  y,
  tone,
  label,
}: {
  x: number;
  y: number;
  tone: "incoming" | "self";
  label: string;
}) {
  const incoming = tone === "incoming";
  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      <span
        className={cx(
          "absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40",
          incoming ? "bg-warning animate-ping" : "bg-brand",
        )}
      />
      <span
        className={cx(
          "relative flex size-5 items-center justify-center rounded-full ring-2 ring-white shadow-lg",
          incoming ? "bg-warning" : "bg-brand",
        )}
      >
        <MousePointer2 className="size-3 text-white" />
      </span>
      <span
        className={cx(
          "mt-1 block max-w-[9rem] truncate rounded-pill px-2 py-0.5 text-center text-caption font-medium text-white shadow",
          incoming ? "bg-warning" : "bg-brand",
        )}
      >
        {label}
      </span>
    </div>
  );
}

/** While the far side points at your camera, show your self-view full-bleed so the laser lands on you. */
export function IncomingSelfView({ stream, show }: { stream: MediaStream | null; show: boolean }) {
  if (!show) return null;
  return (
    <StreamVideo
      stream={stream}
      muted
      className="pointer-events-none absolute inset-0 z-[9] h-full w-full object-cover"
    />
  );
}
