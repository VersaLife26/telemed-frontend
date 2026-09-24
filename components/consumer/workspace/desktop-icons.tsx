"use client";

import { AppIcon, APPS, LAUNCHER_APPS } from "@/components/consumer/workspace/apps";
import { useWindows } from "@/components/consumer/workspace/window-manager";

export function DesktopIcons() {
  const { open } = useWindows();
  return (
    <ul className="absolute left-6 top-16 z-[5] flex flex-col gap-5">
      {LAUNCHER_APPS.map((app) => (
        <li key={app}>
          <button
            type="button"
            onClick={() => open(app)}
            className="flex min-h-11 w-[4.5rem] cursor-pointer flex-col items-center gap-1.5 text-white transition-[scale] duration-[140ms] ease-out active:scale-[0.96]"
          >
            <AppIcon app={app} />
            <span className="text-center text-[0.7rem] font-medium drop-shadow">{APPS[app].label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
