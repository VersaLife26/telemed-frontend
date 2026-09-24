"use client";

import {
  animate,
  motion,
  motionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Circle, Square } from "lucide-react";

import { AppIcon, APPS, LAUNCHER_APPS, type WorkspaceApp } from "@/components/consumer/workspace/apps";
import { useWindows, type WorkspaceWindow } from "@/components/consumer/workspace/window-manager";
import { cx } from "@/lib/consumer/cx";
import { project, rubberband, spring, springFlick } from "@/lib/consumer/motion";

const CARD_SCALE = 0.64;
const GAP = 16;

type Sample = { t: number; x: number; y: number };

function velocity(samples: Sample[]) {
  const last = samples[samples.length - 1];
  const first = samples.find((s) => last && last.t - s.t < 100) ?? samples[0];
  if (!first || !last || last.t === first.t) return { x: 0, y: 0 };
  const dt = (last.t - first.t) / 1000;
  return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
}

/**
 * The workspace on a phone: one app full screen at a time, a gesture bar to
 * switch, and an Android-style recents carousel. Every app stays mounted the
 * whole time (the live call, a half-written prescription), and recents only
 * transforms those same elements rather than drawing snapshots of them.
 */
export function PhoneShell({
  topBar,
  renderApp,
  onCloseWindow,
  home,
}: {
  topBar: ReactNode;
  renderApp: (win: WorkspaceWindow) => ReactNode;
  onCloseWindow: (win: WorkspaceWindow) => void;
  home?: ReactNode;
}) {
  const { windows, focusedId, focus, open } = useWindows();
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 360, h: 640 });
  const [view, setView] = useState<"app" | "home" | "recents">("home");
  const [anchor, setAnchor] = useState(0);
  const progress = useMotionValue(0);
  const offset = useMotionValue(0);

  const ordered = useMemo(() => [...windows].sort((a, b) => a.z - b.z), [windows]);
  const current = ordered.find((w) => w.id === focusedId) ?? null;
  const spacing = stage.w * CARD_SCALE + GAP;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setStage({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Opening or focusing an app anywhere (dock-less: Visits, a Join button) brings it forward.
  useEffect(() => {
    if (focusedId) setView((v) => (v === "recents" ? v : "app"));
    else if (!ordered.length) setView("home");
  }, [focusedId, ordered.length]);

  const toRecents = useCallback(
    (velocityY = 0) => {
      if (!ordered.length) return;
      const idx = Math.max(0, ordered.findIndex((w) => w.id === focusedId));
      setAnchor(idx === -1 ? ordered.length - 1 : idx);
      offset.set(0);
      setView("recents");
      if (reduceMotion) progress.set(1);
      else animate(progress, 1, { ...spring, velocity: -velocityY / 400 });
    },
    [focusedId, offset, ordered, progress, reduceMotion],
  );

  const openCard = useCallback(
    (win: WorkspaceWindow, i: number) => {
      const x = (i - anchor) * spacing + offset.get();
      setAnchor(i);
      offset.set(x);
      focus(win.id);
      setView("app");
      if (reduceMotion) {
        offset.set(0);
        progress.set(0);
        return;
      }
      animate(offset, 0, spring);
      animate(progress, 0, spring);
    },
    [anchor, focus, offset, progress, reduceMotion, spacing],
  );

  const goHome = useCallback(() => {
    setView("home");
    progress.set(0);
  }, [progress]);

  // Leaving recents with no apps left drops back to the home screen.
  useEffect(() => {
    if (view === "recents" && !ordered.length) goHome();
    if (view === "recents") setAnchor((a) => Math.min(a, Math.max(0, ordered.length - 1)));
  }, [goHome, ordered.length, view]);

  const switchBy = useCallback(
    (dir: 1 | -1) => {
      if (!current) return;
      const idx = ordered.findIndex((w) => w.id === current.id);
      const next = ordered[idx + dir];
      if (!next) return;
      focus(next.id);
      const el = document.getElementById(`ws-card-${cssId(next.id)}`);
      if (el && !reduceMotion) {
        el.animate(
          [
            { transform: `translateX(${dir * 28}%)`, opacity: 0.4 },
            { transform: "none", opacity: 1 },
          ],
          { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
        );
      }
    },
    [current, focus, ordered, reduceMotion],
  );

  // --- recents carousel pan ------------------------------------------------
  const pan = useRef<{ sx: number; sy: number; base: number; axis: "x" | "y" | null; id: string | null; samples: Sample[] } | null>(null);

  function onCarouselDown(e: React.PointerEvent<HTMLDivElement>, win: WorkspaceWindow | null) {
    if (pan.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = {
      sx: e.clientX,
      sy: e.clientY,
      base: offset.get(),
      axis: null,
      id: win?.id ?? null,
      samples: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }],
    };
  }

  // Per-card dismiss offsets live outside hooks so they survive reordering.
  const cardY = useRef(new Map<string, MotionValue<number>>());
  const yFor = (id: string) => {
    let mv = cardY.current.get(id);
    if (!mv) {
      mv = motionValue(0);
      cardY.current.set(id, mv);
    }
    return mv;
  };

  function onCarouselMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = pan.current;
    if (!p) return;
    p.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (p.samples.length > 8) p.samples.shift();
    const dx = e.clientX - p.sx;
    const dy = e.clientY - p.sy;
    if (!p.axis) {
      if (Math.hypot(dx, dy) < 10) return;
      p.axis = Math.abs(dx) > Math.abs(dy) || !p.id ? "x" : "y";
    }
    if (p.axis === "x") {
      const min = -(ordered.length - 1 - anchor) * spacing;
      const max = anchor * spacing;
      const raw = p.base + dx;
      offset.set(raw > max ? max + rubberband(raw - max, stage.w) : raw < min ? min + rubberband(raw - min, stage.w) : raw);
    } else if (p.id) {
      yFor(p.id).set(dy < 0 ? dy : rubberband(dy, stage.h));
    }
  }

  function onCarouselUp() {
    const p = pan.current;
    pan.current = null;
    if (!p) return;
    const v = velocity(p.samples);
    if (!p.axis) {
      const i = ordered.findIndex((w) => w.id === p.id);
      const win = ordered[i];
      if (win) openCard(win, i);
      else goHome();
      return;
    }
    if (p.axis === "x") {
      const projected = offset.get() + project(v.x, 0.99);
      const k = Math.round(anchor - projected / spacing);
      const target = -(Math.min(Math.max(k, 0), ordered.length - 1) - anchor) * spacing;
      animate(offset, target, { ...spring, velocity: v.x });
      return;
    }
    if (!p.id) return;
    const y = yFor(p.id);
    const win = ordered.find((w) => w.id === p.id);
    const landing = y.get() + project(v.y, 0.99);
    if (win && (landing < -stage.h * 0.4 || v.y < -900)) {
      animate(y, -stage.h, { ...springFlick, velocity: v.y }).then(() => {
        y.set(0);
        onCloseWindow(win);
      });
    } else {
      animate(y, 0, { ...spring, velocity: v.y });
    }
  }

  // --- gesture bar ---------------------------------------------------------
  const bar = useRef<{ sx: number; sy: number; samples: Sample[]; axis: "x" | "y" | null } | null>(null);

  function onBarDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as Element).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    bar.current = { sx: e.clientX, sy: e.clientY, samples: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }], axis: null };
    if (view === "app" && ordered.length) {
      const idx = ordered.findIndex((w) => w.id === focusedId);
      setAnchor(idx < 0 ? ordered.length - 1 : idx);
      offset.set(0);
    }
  }

  function onBarMove(e: React.PointerEvent<HTMLDivElement>) {
    const b = bar.current;
    if (!b) return;
    b.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (b.samples.length > 8) b.samples.shift();
    const dx = e.clientX - b.sx;
    const dy = e.clientY - b.sy;
    if (!b.axis) {
      if (Math.hypot(dx, dy) < 10) return;
      b.axis = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
      if (b.axis === "y" && view === "app" && ordered.length) setView("recents");
    }
    // Recents follow the finger up, so the gesture is felt, not just triggered.
    if (b.axis === "y" && view !== "home") progress.set(Math.min(1, Math.max(0, -dy / 220)));
  }

  function onBarUp() {
    const b = bar.current;
    bar.current = null;
    if (!b || !b.axis) return;
    const v = velocity(b.samples);
    const last = b.samples[b.samples.length - 1];
    const dx = (last?.x ?? b.sx) - b.sx;
    if (b.axis === "x") {
      if (view === "app" && Math.abs(dx) > 40) switchBy(dx < 0 ? 1 : -1);
      return;
    }
    if (view === "home") {
      toRecents(v.y);
      return;
    }
    if (progress.get() > 0.3 || v.y < -500) toRecents(v.y);
    else {
      animate(progress, 0, spring).then(() => setView("app"));
    }
  }

  const showHome = view === "home" || !ordered.length;

  return (
    <div className="ws-phone">
      {topBar}
      <div ref={stageRef} className="ws-phone-stage">
        {showHome ? (
          <PhoneHome
            onOpen={(app) => {
              open(app);
              setView("app");
            }}
          >
            {home}
          </PhoneHome>
        ) : null}

        {view === "recents" ? (
          <div
            className="ws-recents-scrim"
            onPointerDown={(e) => onCarouselDown(e, null)}
            onPointerMove={onCarouselMove}
            onPointerUp={onCarouselUp}
            onPointerCancel={onCarouselUp}
          />
        ) : null}

        {ordered.map((win, i) => (
          <PhoneCard
            key={win.id}
            win={win}
            index={i}
            anchor={anchor}
            spacing={spacing}
            progress={progress}
            offset={offset}
            y={yFor(win.id)}
            visible={view === "recents" || (view === "app" && win.id === current?.id)}
            recents={view === "recents"}
            onPointerDown={(e) => onCarouselDown(e, win)}
            onPointerMove={onCarouselMove}
            onPointerUp={onCarouselUp}
          >
            {renderApp(win)}
          </PhoneCard>
        ))}

        {view === "recents" && ordered.length ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-caption text-white/60">
            Swipe a card up to close it
          </p>
        ) : null}
      </div>

      <div
        className="ws-gesture-bar"
        onPointerDown={onBarDown}
        onPointerMove={onBarMove}
        onPointerUp={onBarUp}
        onPointerCancel={onBarUp}
      >
        <button type="button" aria-label="Home" className="ws-gesture-btn" onClick={goHome}>
          <Circle className="size-5" strokeWidth={2} />
        </button>
        <span aria-hidden="true" className="ws-gesture-handle" />
        <button
          type="button"
          aria-label="Recent apps"
          aria-pressed={view === "recents"}
          disabled={!ordered.length}
          className="ws-gesture-btn"
          onClick={() => {
            if (view === "recents") {
              const i = ordered.findIndex((w) => w.id === focusedId);
              const win = ordered[i];
              if (win) openCard(win, i);
              else goHome();
            } else toRecents();
          }}
        >
          <Square className="size-4" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}

function cssId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function PhoneCard({
  win,
  index,
  anchor,
  spacing,
  progress,
  offset,
  y,
  visible,
  recents,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  win: WorkspaceWindow;
  index: number;
  anchor: number;
  spacing: number;
  progress: MotionValue<number>;
  offset: MotionValue<number>;
  y: MotionValue<number>;
  visible: boolean;
  recents: boolean;
  children: ReactNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
}) {
  const x = useTransform([progress, offset], ([p, o]) => (p as number) * ((index - anchor) * spacing + (o as number)));
  const scale = useTransform(progress, [0, 1], [1, CARD_SCALE]);
  const radius = useTransform(progress, [0, 1], [0, 28]);
  const fade = useTransform(y, [-600, 0], [0.2, 1]);
  const label = useTransform(progress, [0.6, 1], [0, 1]);

  return (
    <motion.div
      id={`ws-card-${cssId(win.id)}`}
      className={cx("ws-phone-card", !visible && "ws-phone-card-hidden", recents && "ws-phone-card-recents")}
      style={{ x, y, scale, borderRadius: radius, opacity: fade, zIndex: recents ? 10 + index : visible ? 20 : 0 }}
      aria-hidden={!visible}
      inert={!visible || recents}
    >
      <motion.div className="ws-phone-card-label" style={{ opacity: label }}>
        <AppIcon app={win.app} size="sm" />
        <span className="truncate">{win.title}</span>
      </motion.div>
      <div className="ws-phone-card-body">{children}</div>
      {recents ? (
        <div
          role="button"
          tabIndex={-1}
          aria-label={`Open ${win.title}`}
          className="absolute inset-0 z-10"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      ) : null}
    </motion.div>
  );
}

function PhoneHome({ onOpen, children }: { onOpen: (app: WorkspaceApp) => void; children?: ReactNode }) {
  return (
    <div className="ws-phone-home">
      {children}
      <ul className="grid grid-cols-4 gap-x-2 gap-y-5">
        {LAUNCHER_APPS.map((app) => (
          <li key={app}>
            <button
              type="button"
              onClick={() => onOpen(app)}
              className="flex w-full flex-col items-center gap-1.5 text-white transition-[scale] duration-[140ms] ease-out active:scale-[0.94]"
            >
              <AppIcon app={app} size="lg" />
              <span className="w-full truncate text-center text-caption font-medium drop-shadow">
                {APPS[app].label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
