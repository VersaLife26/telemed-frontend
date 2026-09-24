"use client";

import { animate, motion, useMotionValue, useReducedMotion, type PanInfo } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Mic, MicOff, PhoneOff, PictureInPicture2 } from "lucide-react";

import { StreamVideo } from "@/components/consumer/call/stream-video";
import type { ConsultationControls } from "@/lib/consumer/features/use-consultation";
import { cx } from "@/lib/consumer/cx";
import { project, spring } from "@/lib/consumer/motion";

type Corner = "tl" | "tr" | "bl" | "br";

const MARGIN = 16;

function tileSize(vw: number) {
  return vw < 640 ? { w: 124, h: 168 } : { w: 256, h: 160 };
}

function cornerPoint(corner: Corner, vw: number, vh: number) {
  const { w, h } = tileSize(vw);
  // Leaves room for the mobile tab bar and the workspace dock.
  const bottomInset = vw < 768 ? 88 : 76;
  const left = MARGIN;
  const right = vw - w - MARGIN;
  const top = MARGIN + 48;
  const bottom = vh - h - bottomInset;
  return {
    x: corner.endsWith("l") ? left : right,
    y: corner.startsWith("t") ? top : bottom,
  };
}

/**
 * The call, shrunk to a draggable tile while the person uses the rest of the
 * app. It is thrown rather than placed: release velocity is projected forward
 * and the tile settles in the corner nearest to where the throw would land.
 */
export function FloatingCall({
  call,
  onExpand,
  onHangUp,
  pipSupported,
  onPopOut,
}: {
  call: ConsultationControls;
  onExpand: () => void;
  onHangUp: () => void;
  pipSupported: boolean;
  onPopOut: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [corner, setCorner] = useState<Corner>("br");
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragged = useRef(false);

  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const settle = useCallback(
    (target: Corner, velocity?: { x: number; y: number }) => {
      if (!viewport) return;
      const p = cornerPoint(target, viewport.w, viewport.h);
      if (reduceMotion) {
        x.set(p.x);
        y.set(p.y);
        return;
      }
      animate(x, p.x, { ...spring, velocity: velocity?.x ?? 0 });
      animate(y, p.y, { ...spring, velocity: velocity?.y ?? 0 });
    },
    [reduceMotion, viewport, x, y],
  );

  useEffect(() => {
    if (!viewport) return;
    const p = cornerPoint(corner, viewport.w, viewport.h);
    x.set(p.x);
    y.set(p.y);
    // Only on viewport changes: corner changes animate through settle().
  }, [viewport]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (!viewport) return;
    const { w, h } = tileSize(viewport.w);
    const px = x.get() + project(info.velocity.x) + w / 2;
    const py = y.get() + project(info.velocity.y) + h / 2;
    const next: Corner = `${py < viewport.h / 2 ? "t" : "b"}${px < viewport.w / 2 ? "l" : "r"}` as Corner;
    setCorner(next);
    settle(next, info.velocity);
    window.setTimeout(() => {
      dragged.current = false;
    }, 0);
  }

  if (!viewport) return null;
  const { w, h } = tileSize(viewport.w);
  const live = call.live;
  const stream = live ? call.remoteStream : call.localStream;

  return (
    <motion.div
      role="region"
      aria-label="Ongoing call"
      drag
      dragMomentum={false}
      dragElastic={0.2}
      onDragStart={() => {
        dragged.current = true;
      }}
      onDragEnd={onDragEnd}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring}
      style={{ x, y, width: w, height: h }}
      className="group fixed left-0 top-0 z-[70] cursor-grab touch-none overflow-hidden rounded-xl bg-ink-900 shadow-2xl ring-1 ring-white/20 active:cursor-grabbing"
    >
      <button
        type="button"
        aria-label="Return to the call"
        className="absolute inset-0 block"
        onClick={() => {
          if (!dragged.current) onExpand();
        }}
      >
        {stream ? (
          <StreamVideo
            stream={stream}
            muted={!live}
            className={cx("h-full w-full object-cover", !live && "scale-x-[-1] opacity-80")}
          />
        ) : null}
        <span className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/60 to-transparent px-2.5 pb-4 pt-2 text-left text-caption font-medium text-white">
          <span
            aria-hidden="true"
            className={cx("size-1.5 shrink-0 rounded-full", live ? "bg-success" : "animate-pulse bg-warning")}
          />
          <span className="truncate">
            {live ? call.counterpartName || "In call" : call.connecting ? "Connecting…" : "Waiting room"}
          </span>
        </span>
      </button>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-5">
        <TileButton label={call.muted ? "Unmute" : "Mute"} pressed={call.muted} onClick={call.toggleMute}>
          {call.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </TileButton>
        <TileButton label="Expand call" onClick={onExpand}>
          <Maximize2 className="size-4" />
        </TileButton>
        {pipSupported && live ? (
          <TileButton label="Pop out" onClick={onPopOut} className="max-sm:hidden">
            <PictureInPicture2 className="size-4" />
          </TileButton>
        ) : null}
        <TileButton label="Hang up" onClick={onHangUp} danger>
          <PhoneOff className="size-4" />
        </TileButton>
      </div>
    </motion.div>
  );
}

function TileButton({
  label,
  pressed,
  danger,
  className,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  danger?: boolean;
  className?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={cx(
        "flex size-9 items-center justify-center rounded-full text-white backdrop-blur-md",
        "transition-[background-color,transform] duration-[140ms] ease-out active:scale-[0.92]",
        danger ? "bg-danger can-hover:hover:bg-[var(--red-500)]" : "bg-white/15 can-hover:hover:bg-white/25",
        pressed && !danger && "bg-white text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}
