"use client";

import { Power } from "lucide-react";

import { AppIcon, APPS, LAUNCHER_APPS, type WorkspaceApp } from "@/components/consumer/workspace/apps";
import { useWindows } from "@/components/consumer/workspace/window-manager";
import { cx } from "@/lib/consumer/cx";

export function Dock({ onExit }: { onExit: () => void }) {
  const { windows, open, restore, focus, focusedId } = useWindows();
  const extra = windows.filter((w) => !APPS[w.app].launcher);

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
      {LAUNCHER_APPS.map((app) => {
        const win = windows.find((w) => w.id === app);
        const label = APPS[app].label;
        return (
          <button
            key={app}
            type="button"
            title={label}
            aria-label={win?.minimized ? `Restore ${label}` : label}
            className="ws-dock-item"
            onClick={() => activate(app, app)}
          >
            <AppIcon app={app} />
            <span className={cx("ws-dock-dot", win && "opacity-100", focusedId === app && "ws-dock-dot-active")} />
          </button>
        );
      })}
      {extra.length ? <span className="ws-dock-split" aria-hidden="true" /> : null}
      {extra.map((win) => (
        <button
          key={win.id}
          type="button"
          title={win.title}
          aria-label={win.minimized ? `Restore ${win.title}` : win.title}
          className="ws-dock-item"
          onClick={() => activate(win.id, win.app)}
        >
          <AppIcon app={win.app} />
          <span className={cx("ws-dock-dot opacity-100", focusedId === win.id && "ws-dock-dot-active")} />
        </button>
      ))}
      <span className="ws-dock-split" aria-hidden="true" />
      <button type="button" className="ws-dock-power" aria-label="Exit workspace" title="Exit workspace" onClick={onExit}>
        <Power className="size-5" strokeWidth={1.75} />
      </button>
    </nav>
  );
}
