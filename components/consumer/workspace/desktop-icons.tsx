"use client";

import { CalendarDays, FolderClosed, MessageSquare, Video } from "lucide-react";

import { useWindows, type WorkspaceApp } from "@/components/consumer/workspace/window-manager";

const ICONS: { app: WorkspaceApp; label: string; color: string; Icon: typeof Video }[] = [
  { app: "files", label: "File Station", color: "#f59e0b", Icon: FolderClosed },
  { app: "meet", label: "Meet", color: "#2563eb", Icon: Video },
  { app: "calendar", label: "Calendar", color: "#dc2626", Icon: CalendarDays },
  { app: "chat", label: "Chat", color: "#0d9488", Icon: MessageSquare },
];

export function DesktopIcons() {
  const { open } = useWindows();
  return (
    <ul className="absolute left-6 top-16 z-[5] flex flex-col gap-5">
      {ICONS.map(({ app, label, color, Icon }) => (
        <li key={app}>
          <button
            type="button"
            onClick={() => open(app)}
            className="flex min-h-11 w-[4.5rem] cursor-pointer flex-col items-center gap-1.5 text-white transition-transform duration-[120ms] ease-out active:scale-[0.97]"
          >
            <span
              className="flex size-12 items-center justify-center rounded-2xl shadow-md"
              style={{ background: color }}
            >
              <Icon className="size-6" strokeWidth={1.75} />
            </span>
            <span className="text-center text-[0.7rem] font-medium drop-shadow">{label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
