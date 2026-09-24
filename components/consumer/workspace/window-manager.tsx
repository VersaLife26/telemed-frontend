"use client";

import { Columns2, Copy, Minus, Square, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { APPS, type WorkspaceApp } from "@/components/consumer/workspace/apps";
import { cx } from "@/lib/consumer/cx";

export type { WorkspaceApp } from "@/components/consumer/workspace/apps";

export type WindowRect = { x: number; y: number; w: number; h: number };
export type Snap = "left" | "right" | null;
export type WorkspaceMode = "phone" | "tablet" | "desktop";

export type WorkspaceWindow = {
  id: string;
  app: WorkspaceApp;
  title: string;
  props: Record<string, string>;
  rect: WindowRect;
  z: number;
  minimized: boolean;
  maximized: boolean;
  snap: Snap;
};

type OpenOptions = { title?: string; props?: Record<string, string>; id?: string; background?: boolean };

type WindowsApi = {
  mode: WorkspaceMode;
  windows: WorkspaceWindow[];
  focusedId: string | null;
  open: (app: WorkspaceApp, opts?: OpenOptions) => void;
  focus: (id: string) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  move: (id: string, rect: Partial<WindowRect>) => void;
  restore: (id: string) => void;
  setSnap: (id: string, snap: Snap | "max") => void;
  ghost: WindowRect | null;
  setGhost: (rect: WindowRect | null) => void;
};

const WindowsContext = createContext<WindowsApi | null>(null);

/** Height of the menu bar; windows never go above it. */
export const AREA_TOP = 36;
/** Space kept clear for the dock when a window fills or splits the screen. */
const DOCK_INSET = 88;
const EDGE = 6;
const LAYOUT_KEY = "vl-workspace-layout:v1";

let zCounter = 10;

function viewport() {
  return { vw: window.innerWidth, vh: window.innerHeight };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(Math.max(n, lo), Math.max(lo, hi));
}

/** Keeps a floating window fully on screen and no smaller than its app allows. */
export function clampRect(rect: WindowRect, app: WorkspaceApp): WindowRect {
  const { vw, vh } = viewport();
  const min = APPS[app].min;
  const w = clamp(rect.w, Math.min(min.w, vw - 16), vw - 16);
  const h = clamp(rect.h, Math.min(min.h, vh - AREA_TOP - 8), vh - AREA_TOP - 8);
  return {
    w,
    h,
    x: clamp(rect.x, 8, vw - w - 8),
    y: clamp(rect.y, AREA_TOP + 4, vh - h - 4),
  };
}

export function areaRect(snap: Snap | "max"): WindowRect {
  const { vw, vh } = viewport();
  const h = vh - AREA_TOP - DOCK_INSET;
  if (snap === "left") return { x: 0, y: AREA_TOP, w: Math.floor(vw / 2), h };
  if (snap === "right") return { x: Math.ceil(vw / 2), y: AREA_TOP, w: Math.floor(vw / 2), h };
  return { x: 0, y: AREA_TOP, w: vw, h };
}

function readLayout(): Partial<Record<WorkspaceApp, WindowRect>> {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<WorkspaceApp, WindowRect>>) : {};
  } catch {
    return {};
  }
}

export function saveLayout(app: WorkspaceApp, rect: WindowRect) {
  try {
    const layout = readLayout();
    layout[app] = rect;
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    /* storage unavailable: layout just won't persist */
  }
}

export function useWorkspaceMode(): WorkspaceMode | null {
  const [mode, setMode] = useState<WorkspaceMode | null>(null);
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 767.98px)");
    const tablet = window.matchMedia("(max-width: 1279.98px)");
    const update = () => setMode(phone.matches ? "phone" : tablet.matches ? "tablet" : "desktop");
    update();
    phone.addEventListener("change", update);
    tablet.addEventListener("change", update);
    return () => {
      phone.removeEventListener("change", update);
      tablet.removeEventListener("change", update);
    };
  }, []);
  return mode;
}

export function WindowManagerProvider({ mode, children }: { mode: WorkspaceMode; children: ReactNode }) {
  const [windows, setWindows] = useState<WorkspaceWindow[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<WindowRect | null>(null);

  const open = useCallback(
    (app: WorkspaceApp, opts?: OpenOptions) => {
      const id = opts?.id ?? (app === "viewer" ? `viewer:${opts?.props?.id ?? crypto.randomUUID()}` : app);
      setWindows((current) => {
        const existing = current.find((w) => w.id === id);
        zCounter += 1;
        if (existing) {
          if (opts?.background) return current;
          return current.map((w) =>
            w.id === id ? { ...w, minimized: false, z: zCounter, title: opts?.title ?? w.title } : w,
          );
        }
        const saved = readLayout()[app];
        const base = APPS[app].size;
        const offset = (current.length % 6) * 24;
        const rect = clampRect(saved ?? { x: 96 + offset, y: 64 + offset, w: base.w, h: base.h }, app);
        return [
          ...current,
          {
            id,
            app,
            title: opts?.title ?? APPS[app].label,
            props: opts?.props ?? {},
            rect,
            z: opts?.background ? 1 : zCounter,
            minimized: Boolean(opts?.background),
            maximized: false,
            snap: null,
          },
        ];
      });
      if (!opts?.background) setFocusedId(id);
    },
    [],
  );

  const focus = useCallback((id: string) => {
    zCounter += 1;
    setFocusedId(id);
    setWindows((current) => current.map((w) => (w.id === id ? { ...w, z: zCounter, minimized: false } : w)));
  }, []);

  const close = useCallback((id: string) => {
    setWindows((current) => current.filter((w) => w.id !== id));
    setFocusedId((current) => (current === id ? null : current));
  }, []);

  const minimize = useCallback((id: string) => {
    setWindows((current) => current.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
    setFocusedId((current) => (current === id ? null : current));
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    setWindows((current) =>
      current.map((w) =>
        w.id === id ? { ...w, maximized: !(w.maximized || w.snap), snap: null, minimized: false } : w,
      ),
    );
  }, []);

  const setSnap = useCallback((id: string, snap: Snap | "max") => {
    setWindows((current) =>
      current.map((w) => {
        if (w.id === id) return { ...w, snap: snap === "max" ? null : snap, maximized: snap === "max", minimized: false };
        // Two windows can't share a half; the one already there goes full so nothing is hidden underneath.
        if (snap !== "max" && snap && w.snap === snap) return { ...w, snap: null, maximized: true };
        return w;
      }),
    );
  }, []);

  const move = useCallback((id: string, rect: Partial<WindowRect>) => {
    setWindows((current) =>
      current.map((w) =>
        w.id === id ? { ...w, rect: { ...w.rect, ...rect }, maximized: false, snap: null } : w,
      ),
    );
  }, []);

  useEffect(() => {
    const onResize = () =>
      setWindows((current) => current.map((w) => ({ ...w, rect: clampRect(w.rect, w.app) })));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // On a tablet there is no free-floating: new windows start full screen.
  useEffect(() => {
    if (mode !== "tablet") return;
    setWindows((current) =>
      current.map((w) => (w.maximized || w.snap ? w : { ...w, maximized: true })),
    );
  }, [mode, windows.length]);

  const api = useMemo(
    () => ({
      mode,
      windows,
      focusedId,
      open,
      focus,
      close,
      minimize,
      toggleMaximize,
      move,
      restore: focus,
      setSnap,
      ghost,
      setGhost,
    }),
    [mode, windows, focusedId, open, focus, close, minimize, toggleMaximize, move, setSnap, ghost],
  );

  return <WindowsContext.Provider value={api}>{children}</WindowsContext.Provider>;
}

export function useWindows(): WindowsApi {
  const ctx = useContext(WindowsContext);
  if (!ctx) throw new Error("useWindows must be used inside WindowManagerProvider");
  return ctx;
}

type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const EDGES: Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

function snapZone(x: number, y: number, mode: WorkspaceMode): Snap | "max" | null {
  const { vw } = viewport();
  if (mode === "tablet") return x < vw / 3 ? "left" : x > (vw * 2) / 3 ? "right" : "max";
  if (y <= AREA_TOP + EDGE) return "max";
  if (x <= EDGE) return "left";
  if (x >= vw - EDGE) return "right";
  return null;
}

/** A floating window on desktop, or a full/half-screen pane on a tablet. */
export function WindowFrame({
  win,
  onClose,
  children,
}: {
  win: WorkspaceWindow;
  onClose?: () => void;
  children: ReactNode;
}) {
  const { mode, focus, close, minimize, toggleMaximize, move, setSnap, setGhost, focusedId } = useWindows();
  const drag = useRef<{
    mx: number;
    my: number;
    ox: number;
    oy: number;
    detached: boolean;
    zone: Snap | "max" | null;
  } | null>(null);
  const resize = useRef<{ edge: Edge; mx: number; my: number; start: WindowRect } | null>(null);

  if (win.minimized) return null;

  const docked = win.maximized || win.snap;
  const r = docked ? areaRect(win.snap ?? "max") : win.rect;
  const tablet = mode === "tablet";

  function isControl(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("[data-ws-controls]"));
  }

  function onTitleDown(event: React.PointerEvent<HTMLElement>) {
    if (isControl(event.target) || event.button !== 0) return;
    drag.current = {
      mx: event.clientX,
      my: event.clientY,
      ox: r.x,
      oy: r.y,
      detached: !docked,
      zone: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onTitleMove(event: React.PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.mx;
    const dy = event.clientY - d.my;
    if (!d.detached && Math.hypot(dx, dy) < 8) return;

    const zone = snapZone(event.clientX, event.clientY, mode);
    d.zone = zone;
    setGhost(zone ? areaRect(zone) : null);
    if (tablet) return;

    if (!d.detached) {
      // Pulling a docked window off an edge restores its floating size under
      // the pointer, keeping the grab point proportionally where it was.
      const ratio = (d.mx - r.x) / r.w;
      d.ox = event.clientX - win.rect.w * ratio;
      d.oy = event.clientY - 18;
      d.mx = event.clientX;
      d.my = event.clientY;
      d.detached = true;
    }
    move(win.id, clampRect({ ...win.rect, x: d.ox + event.clientX - d.mx, y: d.oy + event.clientY - d.my }, win.app));
  }

  function onTitleUp() {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d) return;
    if (d.zone) setSnap(win.id, d.zone);
    else if (d.detached && !tablet) saveLayout(win.app, win.rect);
  }

  function onResizeDown(edge: Edge, event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    resize.current = { edge, mx: event.clientX, my: event.clientY, start: win.rect };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    const rs = resize.current;
    if (!rs) return;
    const { vw, vh } = viewport();
    const min = APPS[win.app].min;
    const dx = event.clientX - rs.mx;
    const dy = event.clientY - rs.my;
    let { x, y, w, h } = rs.start;
    if (rs.edge.includes("e")) w = clamp(rs.start.w + dx, min.w, vw - x - 8);
    if (rs.edge.includes("s")) h = clamp(rs.start.h + dy, min.h, vh - y - 4);
    if (rs.edge.includes("w")) {
      const nx = clamp(rs.start.x + dx, 8, rs.start.x + rs.start.w - min.w);
      w = rs.start.w + (rs.start.x - nx);
      x = nx;
    }
    if (rs.edge.includes("n")) {
      const ny = clamp(rs.start.y + dy, AREA_TOP + 4, rs.start.y + rs.start.h - min.h);
      h = rs.start.h + (rs.start.y - ny);
      y = ny;
    }
    move(win.id, { x, y, w, h });
  }

  function onResizeUp() {
    if (!resize.current) return;
    resize.current = null;
    saveLayout(win.app, win.rect);
  }

  return (
    <section
      className="ws-window"
      style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: win.z }}
      onPointerDown={() => {
        if (focusedId !== win.id) focus(win.id);
      }}
      data-focused={focusedId === win.id ? "true" : "false"}
      data-docked={docked ? "true" : "false"}
      aria-label={win.title}
    >
      <header
        className="ws-titlebar"
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        onPointerCancel={onTitleUp}
        onDoubleClick={(event) => {
          if (isControl(event.target)) return;
          if (tablet) setSnap(win.id, "max");
          else toggleMaximize(win.id);
        }}
      >
        <h2 className="ws-title">{win.title}</h2>
        <div className="ws-controls" data-ws-controls>
          <button
            type="button"
            aria-label="Minimize"
            className="ws-ctrl"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => minimize(win.id)}
          >
            <Minus strokeWidth={2.25} />
          </button>
          {tablet ? (
            <button
              type="button"
              aria-label="Split screen"
              title={win.snap === "left" ? "Move to right half" : win.snap === "right" ? "Full screen" : "Split to left half"}
              className="ws-ctrl"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setSnap(win.id, win.snap === "left" ? "right" : win.snap === "right" ? "max" : "left")}
            >
              <Columns2 strokeWidth={2.25} />
            </button>
          ) : (
            <button
              type="button"
              aria-label={docked ? "Restore" : "Maximize"}
              className="ws-ctrl"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => toggleMaximize(win.id)}
            >
              {docked ? <Copy strokeWidth={2.25} /> : <Square strokeWidth={2.25} />}
            </button>
          )}
          <button
            type="button"
            aria-label="Close"
            className="ws-ctrl ws-ctrl-close"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose ?? (() => close(win.id))}
          >
            <X strokeWidth={2.25} />
          </button>
        </div>
      </header>
      <div className="ws-body">{children}</div>
      {!docked && !tablet
        ? EDGES.map((edge) => (
            <div
              key={edge}
              aria-hidden="true"
              className={cx("ws-resize", `ws-resize-${edge}`)}
              onPointerDown={(event) => onResizeDown(edge, event)}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeUp}
              onPointerCancel={onResizeUp}
            />
          ))
        : null}
    </section>
  );
}

export function SnapGhost() {
  const { ghost } = useWindows();
  if (!ghost) return null;
  return (
    <div
      aria-hidden="true"
      className="ws-ghost"
      style={{ left: ghost.x + 6, top: ghost.y + 6, width: ghost.w - 12, height: ghost.h - 12 }}
    />
  );
}
