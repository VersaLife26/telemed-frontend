"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type WorkspaceApp = "meet" | "files" | "calendar" | "chat" | "viewer";

export type WindowRect = { x: number; y: number; w: number; h: number };

export type WorkspaceWindow = {
  id: string;
  app: WorkspaceApp;
  title: string;
  props: Record<string, string>;
  rect: WindowRect;
  z: number;
  minimized: boolean;
  maximized: boolean;
};

type WindowsApi = {
  windows: WorkspaceWindow[];
  focusedId: string | null;
  open: (app: WorkspaceApp, opts?: { title?: string; props?: Record<string, string>; id?: string }) => void;
  focus: (id: string) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  move: (id: string, rect: Partial<WindowRect>) => void;
  restore: (id: string) => void;
};

const WindowsContext = createContext<WindowsApi | null>(null);

const DEFAULTS: Record<WorkspaceApp, WindowRect> = {
  meet: { x: 72, y: 56, w: 880, h: 560 },
  files: { x: 120, y: 72, w: 920, h: 600 },
  calendar: { x: 88, y: 64, w: 980, h: 640 },
  chat: { x: 220, y: 110, w: 420, h: 520 },
  viewer: { x: 180, y: 90, w: 740, h: 560 },
};

let zCounter = 10;

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<WorkspaceWindow[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const open = useCallback(
    (app: WorkspaceApp, opts?: { title?: string; props?: Record<string, string>; id?: string }) => {
      const id = opts?.id ?? (app === "viewer" ? `viewer:${opts?.props?.id ?? crypto.randomUUID()}` : app);
      setWindows((current) => {
        const existing = current.find((w) => w.id === id);
        zCounter += 1;
        if (existing) {
          return current.map((w) =>
            w.id === id ? { ...w, minimized: false, z: zCounter, title: opts?.title ?? w.title } : w,
          );
        }
        const offset = current.length * 18;
        const base = DEFAULTS[app];
        return [
          ...current,
          {
            id,
            app,
            title: opts?.title ?? titleFor(app),
            props: opts?.props ?? {},
            rect: { ...base, x: base.x + offset, y: base.y + offset },
            z: zCounter,
            minimized: false,
            maximized: false,
          },
        ];
      });
      setFocusedId(id);
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
    setWindows((current) => current.map((w) => (w.id === id ? { ...w, minimized: true, maximized: false } : w)));
  }, []);

  const restore = useCallback((id: string) => {
    focus(id);
  }, [focus]);

  const toggleMaximize = useCallback((id: string) => {
    setWindows((current) =>
      current.map((w) => (w.id === id ? { ...w, maximized: !w.maximized, minimized: false } : w)),
    );
  }, []);

  const move = useCallback((id: string, rect: Partial<WindowRect>) => {
    setWindows((current) =>
      current.map((w) => (w.id === id ? { ...w, rect: { ...w.rect, ...rect }, maximized: false } : w)),
    );
  }, []);

  const api = useMemo(
    () => ({ windows, focusedId, open, focus, close, minimize, toggleMaximize, move, restore }),
    [windows, focusedId, open, focus, close, minimize, toggleMaximize, move, restore],
  );

  return <WindowsContext.Provider value={api}>{children}</WindowsContext.Provider>;
}

export function useWindows(): WindowsApi {
  const ctx = useContext(WindowsContext);
  if (!ctx) throw new Error("useWindows must be used inside WindowManagerProvider");
  return ctx;
}

export function WindowFrame({
  win,
  onClose,
  children,
}: {
  win: WorkspaceWindow;
  onClose?: () => void;
  children: ReactNode;
}) {
  const { focus, close, minimize, toggleMaximize, move, focusedId } = useWindows();
  const drag = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const resize = useRef<{ mx: number; my: number; ow: number; oh: number } | null>(null);

  if (win.minimized) return null;

  const style = win.maximized
    ? { left: 0, top: 36, width: "100%", height: "calc(100% - 36px)", zIndex: win.z }
    : { left: win.rect.x, top: win.rect.y, width: win.rect.w, height: win.rect.h, zIndex: win.z };

  return (
    <section
      className="ws-window"
      style={style}
      onPointerDown={() => focus(win.id)}
      data-focused={focusedId === win.id ? "true" : "false"}
    >
      <header
        className="ws-titlebar"
        onPointerDown={(event) => {
          if (win.maximized) return;
          drag.current = { mx: event.clientX, my: event.clientY, ox: win.rect.x, oy: win.rect.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          move(win.id, {
            x: Math.max(0, drag.current.ox + event.clientX - drag.current.mx),
            y: Math.max(36, drag.current.oy + event.clientY - drag.current.my),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onDoubleClick={() => toggleMaximize(win.id)}
      >
        <div className="ws-traffic">
          <button type="button" aria-label="Close" className="ws-dot ws-dot-close" onClick={onClose ?? (() => close(win.id))} />
          <button type="button" aria-label="Minimize" className="ws-dot ws-dot-min" onClick={() => minimize(win.id)} />
          <button type="button" aria-label="Maximize" className="ws-dot ws-dot-max" onClick={() => toggleMaximize(win.id)} />
        </div>
        <h2 className="ws-title">{win.title}</h2>
      </header>
      <div className="ws-body">{children}</div>
      {!win.maximized ? (
        <div
          className="ws-resize"
          onPointerDown={(event) => {
            resize.current = { mx: event.clientX, my: event.clientY, ow: win.rect.w, oh: win.rect.h };
            event.currentTarget.setPointerCapture(event.pointerId);
            event.stopPropagation();
          }}
          onPointerMove={(event) => {
            if (!resize.current) return;
            move(win.id, {
              w: Math.max(360, resize.current.ow + event.clientX - resize.current.mx),
              h: Math.max(240, resize.current.oh + event.clientY - resize.current.my),
            });
          }}
          onPointerUp={() => {
            resize.current = null;
          }}
        />
      ) : null}
    </section>
  );
}

function titleFor(app: WorkspaceApp): string {
  switch (app) {
    case "meet":
      return "Meet";
    case "files":
      return "File Station";
    case "calendar":
      return "Calendar";
    case "chat":
      return "Chat";
    case "viewer":
      return "Preview";
  }
}
