"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Maximize,
  Minimize,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  MoreHorizontal,
  MousePointer2,
  PhoneOff,
  PictureInPicture2,
  Video,
  VideoOff,
} from "lucide-react";

import { useOptionalCall } from "@/components/consumer/call/call-provider";
import { IncomingSelfView, PointerLayer } from "@/components/consumer/call/pointer-layer";
import { StreamVideo } from "@/components/consumer/call/stream-video";
import type { ConsultationControls } from "@/lib/consumer/features/use-consultation";
import { cx } from "@/lib/consumer/cx";
import { spring } from "@/lib/consumer/motion";

export type StageAction = {
  id: string;
  label: string;
  icon: ReactNode;
  pressed?: boolean;
  onClick: () => void;
};

const IDLE_MS = 3000;

/**
 * The live call surface shared by the patient screen and the doctor's Meet
 * window. It sizes itself with container queries rather than the viewport,
 * because in the workspace it lives in a window that can be any size.
 */
export function CallStage({
  call,
  counterpart,
  actions = [],
  onLeave,
  topRight,
  alerts,
  className,
}: {
  call: ConsultationControls;
  counterpart: string;
  actions?: StageAction[];
  onLeave: () => void;
  topRight?: ReactNode;
  alerts?: ReactNode;
  className?: string;
}) {
  const ctx = useOptionalCall();
  const stageRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [more, setMore] = useState(false);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia));
  }, []);

  const wake = useCallback(() => {
    setIdle(false);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);

  useEffect(() => {
    wake();
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [wake]);

  const hideChrome = idle && !more && !call.sharing;
  const pointerOn = call.remotePointer?.active && call.remotePointer.surface === "video" && !call.pointing;

  const secondary: StageAction[] = [
    {
      id: "pointer",
      label: call.pointing ? "Stop pointing" : "Point",
      icon: <MousePointer2 className="size-5" />,
      pressed: call.pointing,
      onClick: call.togglePointing,
    },
    ...actions,
    ...(ctx?.pipSupported
      ? [
          {
            id: "pip",
            label: "Pop out",
            icon: <PictureInPicture2 className="size-5" />,
            onClick: () => void ctx.popOut(),
          },
        ]
      : []),
    {
      id: "fit",
      label: fit === "cover" ? "Fit video" : "Fill screen",
      icon: fit === "cover" ? <Minimize className="size-5" /> : <Maximize className="size-5" />,
      onClick: () => setFit((f) => (f === "cover" ? "contain" : "cover")),
    },
  ];

  return (
    <div
      ref={stageRef}
      className={cx("@container relative h-full w-full overflow-hidden bg-ink-900", className)}
      onPointerMove={wake}
      onPointerDown={wake}
      onKeyDown={wake}
    >
      <StreamVideo
        stream={call.remoteStream}
        onDoubleClick={() => setFit((f) => (f === "cover" ? "contain" : "cover"))}
        className={cx("h-full w-full", fit === "cover" ? "object-cover" : "object-contain")}
      />
      <IncomingSelfView stream={call.localStream} show={Boolean(pointerOn)} />
      <PointerLayer
        pointing={call.pointing}
        local={call.localPointer}
        remote={call.remotePointer}
        surface="video"
        incomingLabel={counterpart || "Pointing"}
        onMove={call.movePointer}
        onLeave={call.leavePointer}
      />

      <SelfTiles call={call} stageRef={stageRef} raised={!hideChrome} />

      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 bg-gradient-to-b from-black/50 to-transparent p-3 pb-8 @lg:p-4",
          "transition-[opacity,translate] duration-[240ms] ease-[var(--ease-out)]",
          hideChrome && "-translate-y-2 opacity-0",
        )}
      >
        <div className="glass-dark pointer-events-auto flex min-w-0 items-center gap-2 rounded-pill py-1.5 pl-2.5 pr-3 text-body-sm font-medium text-white">
          <QualityDot quality={call.quality} />
          <span className="truncate">{counterpart || "In call"}</span>
        </div>
        {topRight ? <div className="pointer-events-auto shrink-0">{topRight}</div> : null}
      </div>

      {call.sharing ? (
        <div className="absolute inset-x-0 top-14 z-30 flex justify-center px-3 @lg:top-16">
          <div className="glass-dark flex items-center gap-3 rounded-pill py-1.5 pl-4 pr-1.5 text-body-sm text-white shadow-lg">
            <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-danger" />
            <span className="@max-sm:hidden">You&rsquo;re sharing your screen</span>
            <span className="@sm:hidden">Sharing</span>
            <button
              type="button"
              onClick={() => void call.toggleScreenShare()}
              className="min-h-9 rounded-pill bg-danger px-4 font-semibold text-white transition-[background-color,scale] duration-[140ms] ease-out active:scale-[0.97] can-hover:hover:bg-[var(--red-500)]"
            >
              Stop sharing
            </button>
          </div>
        </div>
      ) : null}

      {alerts ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-24 z-30 mx-auto flex max-w-lg flex-col gap-2 [&>*]:pointer-events-auto">
          {alerts}
        </div>
      ) : null}

      <div
        className={cx(
          "absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          "transition-[opacity,translate] duration-[240ms] ease-[var(--ease-out)]",
          hideChrome && "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <div className="relative">
          {more ? (
            <MoreSheet
              actions={secondary}
              onClose={() => setMore(false)}
            />
          ) : null}
          <div
            role="toolbar"
            aria-label="Call controls"
            className="glass-dark flex items-center gap-1.5 rounded-pill p-1.5 shadow-xl @lg:gap-2 @lg:p-2"
          >
            <StageButton
              label={call.muted ? "Unmute" : "Mute"}
              pressed={call.muted}
              warn={call.muted}
              onClick={call.toggleMute}
            >
              {call.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </StageButton>
            <StageButton
              label={call.cameraOff ? "Start video" : "Stop video"}
              pressed={call.cameraOff}
              warn={call.cameraOff}
              onClick={call.toggleCamera}
            >
              {call.cameraOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
            </StageButton>
            {canShare ? (
              <StageButton
                label={call.sharing ? "Stop sharing" : "Share screen"}
                pressed={call.sharing}
                active={call.sharing}
                onClick={() => void call.toggleScreenShare()}
              >
                {call.sharing ? <MonitorOff className="size-5" /> : <MonitorUp className="size-5" />}
              </StageButton>
            ) : null}
            {secondary.map((a) => (
              <StageButton
                key={a.id}
                label={a.label}
                pressed={a.pressed}
                active={a.pressed}
                onClick={a.onClick}
                className="hidden @2xl:flex"
              >
                {a.icon}
              </StageButton>
            ))}
            <StageButton
              label="More"
              pressed={more}
              onClick={() => setMore((m) => !m)}
              className="@2xl:hidden"
            >
              <MoreHorizontal className="size-5" />
            </StageButton>
            <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-white/15" />
            <button
              type="button"
              onClick={onLeave}
              aria-label="Leave call"
              className="flex h-11 items-center gap-2 rounded-pill bg-danger px-4 font-semibold text-white transition-[background-color,scale] duration-[140ms] ease-out active:scale-[0.96] can-hover:hover:bg-[var(--red-500)]"
            >
              <PhoneOff className="size-5" />
              <span className="hidden text-body-sm @lg:inline">Leave</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageButton({
  label,
  pressed,
  warn,
  active,
  className,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  warn?: boolean;
  active?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-white",
        "transition-[background-color,color,scale] duration-[140ms] ease-out active:scale-[0.94]",
        warn
          ? "bg-white text-ink"
          : active
            ? "bg-brand text-white"
            : "bg-white/10 can-hover:hover:bg-white/20",
        className,
      )}
    >
      {children}
    </button>
  );
}

function MoreSheet({ actions, onClose }: { actions: StageAction[]; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button type="button" aria-label="Close menu" className="fixed inset-0 cursor-default" onClick={onClose} />
      <motion.div
        role="menu"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spring}
        style={{ transformOrigin: "bottom right" }}
        className="glass-dark absolute bottom-full right-0 mb-2 flex w-56 flex-col gap-0.5 rounded-lg p-1.5 shadow-xl"
      >
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            role="menuitemcheckbox"
            aria-checked={Boolean(a.pressed)}
            onClick={() => {
              a.onClick();
              onClose();
            }}
            className={cx(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-body-sm text-white",
              "transition-[background-color] duration-[140ms] ease-out can-hover:hover:bg-white/10",
              a.pressed && "bg-white/15",
            )}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </motion.div>
    </>
  );
}

function QualityDot({ quality }: { quality: ConsultationControls["quality"] }) {
  const tone =
    quality === "excellent" || quality === "good"
      ? "bg-success"
      : quality === "poor"
        ? "bg-warning"
        : quality === "lost"
          ? "bg-danger"
          : "bg-white/40";
  return (
    <span
      role="img"
      aria-label={quality ? `Connection ${quality}` : "Measuring connection"}
      title={quality ? `Connection: ${quality}` : "Measuring connection"}
      className={cx("size-2 shrink-0 rounded-full", tone)}
    />
  );
}

/**
 * Your camera, and while sharing a preview of what you are sharing, as one
 * draggable stack that settles in the nearest corner of the stage.
 */
function SelfTiles({
  call,
  stageRef,
  raised,
}: {
  call: ConsultationControls;
  stageRef: React.RefObject<HTMLDivElement | null>;
  raised: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [corner, setCorner] = useState<"tl" | "tr" | "bl" | "br">("br");

  return (
    <motion.div
      layout={!reduceMotion}
      transition={spring}
      drag
      dragConstraints={stageRef}
      dragElastic={0.15}
      dragSnapToOrigin
      onDragEnd={(_, info) => {
        const stage = stageRef.current?.getBoundingClientRect();
        if (!stage) return;
        const vx = info.velocity.x * 0.15;
        const vy = info.velocity.y * 0.15;
        const cx = info.point.x + vx - stage.left;
        const cy = info.point.y + vy - stage.top;
        setCorner(`${cy < stage.height / 2 ? "t" : "b"}${cx < stage.width / 2 ? "l" : "r"}`);
      }}
      className={cx(
        "absolute z-[25] flex cursor-grab touch-none flex-col gap-2 active:cursor-grabbing",
        corner.startsWith("t") ? "top-16" : raised ? "bottom-24" : "bottom-4",
        corner.endsWith("l") ? "left-3 @lg:left-4" : "right-3 @lg:right-4",
      )}
    >
      {call.sharing && call.screenStream ? (
        <figure className="relative w-[34cqw] max-w-60 min-w-28 overflow-hidden rounded-lg bg-black shadow-xl ring-2 ring-brand">
          <StreamVideo stream={call.screenStream} muted className="aspect-video w-full object-contain" />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-caption font-medium text-white">
            You&rsquo;re presenting
          </figcaption>
        </figure>
      ) : null}
      <div className="relative w-[26cqw] max-w-44 min-w-24 overflow-hidden rounded-lg bg-ink-800 shadow-xl ring-1 ring-white/30">
        <StreamVideo
          stream={call.localStream}
          muted
          className={cx("aspect-[4/3] w-full scale-x-[-1] object-cover", call.cameraOff && "opacity-0")}
        />
        {call.cameraOff ? (
          <span className="absolute inset-0 flex items-center justify-center text-white/60">
            <VideoOff className="size-5" />
          </span>
        ) : null}
        {call.muted ? (
          <span className="absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
            <MicOff className="size-3.5" />
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}
