"use client";

import { CalendarDays, FileText, FolderClosed, MessageSquare, Power, Video } from "lucide-react";

import { useWindows, type WorkspaceApp } from "@/components/consumer/workspace/window-manager";
import { cx } from "@/lib/consumer/cx";

const APPS: { app: WorkspaceApp; label: string; color: string; Icon: typeof Video }[] = [
  { app: "meet", label: "Meet", color: "#2563eb", Icon: Video },
  { app: "files", label: "File Station", color: "#f59e0b", Icon: FolderClosed },
  { app: "calendar", label: "Calendar", color: "#dc2626", Icon: CalendarDays },
  { app: "chat", label: "Chat", color: "#0d9488", Icon: MessageSquare },
];

export function Dock({ onExit }: { onExit: () => void }) {
  const { windows, open, restore, focus } = useWindows();
  const viewers = windows.filter((w) => w.app === "viewer");

  function activate(id: string, app: WorkspaceApp) {
    const win = windows.find((w) => w.id === id);
    if (!win) {
      open(app, { id });
      return;
    }
    if (win.minimized) restore(id);
    else focus(id);
  }

  return (
    <nav aria-label="Dock" className="ws-dock">
      {APPS.map(({ app, label, color, Icon }) => {
        const win = windows.find((w) => w.id === app);
        const present = Boolean(win);
        return (
          <button
            key={app}
            type="button"
            title={label}
            aria-label={win?.minimized ? `Restore ${label}` : label}
            className="ws-dock-item"
            onClick={() => activate(app, app)}
          >
            <span
              className="flex size-12 items-center justify-center rounded-2xl shadow-md"
              style={{ background: color }}
            >
              <Icon className="size-6 text-white" strokeWidth={1.75} />
            </span>
            <span className={cx("ws-dock-dot", present && "opacity-100")} />
          </button>
        );
      })}
      {viewers.map((win) => (
        <button
          key={win.id}
          type="button"
          title={win.title}
          aria-label={win.minimized ? `Restore ${win.title}` : win.title}
          className="ws-dock-item"
          onClick={() => activate(win.id, "viewer")}
        >
          <span
            className="flex size-12 items-center justify-center rounded-2xl shadow-md"
            style={{ background: "#64748b" }}
          >
            <FileText className="size-6 text-white" strokeWidth={1.75} />
          </span>
          <span className="ws-dock-dot opacity-100" />
        </button>
      ))}
      <span className="ws-dock-split" aria-hidden="true" />
      <button type="button" className="ws-dock-power" aria-label="Exit workspace" title="Exit workspace" onClick={onExit}>
        <Power className="size-5" strokeWidth={1.75} />
      </button>
    </nav>
  );
}
