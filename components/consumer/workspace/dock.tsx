"use client";

import { CalendarDays, FolderClosed, MessageSquare, Video } from "lucide-react";

import { useWindows, type WorkspaceApp } from "@/components/consumer/workspace/window-manager";
import { cx } from "@/lib/consumer/cx";

const APPS: { app: WorkspaceApp; label: string; color: string; Icon: typeof Video }[] = [
  { app: "meet", label: "Meet", color: "#2563eb", Icon: Video },
  { app: "files", label: "File Station", color: "#f59e0b", Icon: FolderClosed },
  { app: "calendar", label: "Calendar", color: "#dc2626", Icon: CalendarDays },
  { app: "chat", label: "Chat", color: "#0d9488", Icon: MessageSquare },
];

export function Dock() {
  const { windows, open, restore } = useWindows();
  return (
    <nav aria-label="Dock" className="ws-dock">
      {APPS.map(({ app, label, color, Icon }) => {
        const running = windows.some((w) => w.app === app && w.id === app);
        const minimized = windows.find((w) => w.id === app)?.minimized;
        return (
          <button
            key={app}
            type="button"
            title={label}
            aria-label={label}
            className="ws-dock-item"
            onClick={() => (minimized ? restore(app) : open(app))}
          >
            <span
              className="flex size-12 items-center justify-center rounded-2xl shadow-md"
              style={{ background: color }}
            >
              <Icon className="size-6 text-white" strokeWidth={1.75} />
            </span>
            <span className={cx("ws-dock-dot", running && "opacity-100")} />
          </button>
        );
      })}
    </nav>
  );
}
