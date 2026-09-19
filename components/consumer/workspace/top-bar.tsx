"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/consumer/ui/Badge";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment } from "@/lib/consumer/api/types";
import { colomboDayKey } from "@/lib/consumer/features/calendar";
import { formatVisitClock } from "@/lib/consumer/features/patient-appointment";
import type { ConsultationControls } from "@/lib/consumer/features/use-consultation";
import { useWindows, type WorkspaceApp } from "@/components/consumer/workspace/window-manager";

const CLOCK = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function TopBar({
  call,
  callId,
}: {
  call: ConsultationControls;
  callId: string | null;
}) {
  const { windows, focusedId, open } = useWindows();
  const [now, setNow] = useState(() => new Date());
  const [openClock, setOpenClock] = useState(false);
  const focused = windows.find((w) => w.id === focusedId);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const live = Boolean(callId && call.live);

  return (
    <header className="ws-menubar">
      <div className="flex min-w-0 items-center gap-3">
        <AppMenu onOpen={open} />
        <p className="truncate text-[0.8125rem] font-medium text-white/90">
          {focused && !focused.minimized ? focused.title : "VersaLife"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {live ? (
          <Badge tone="success" dot>
            In call{call.counterpartName ? ` · ${call.counterpartName}` : ""}
          </Badge>
        ) : callId ? (
          <Badge tone="warning" dot>
            Waiting
          </Badge>
        ) : null}
        <div className="relative">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-[0.8125rem] text-white/90 tabular-time can-hover:hover:bg-white/10"
            onClick={() => setOpenClock((v) => !v)}
          >
            {CLOCK.format(now)}
          </button>
          {openClock ? <ClockPopover onClose={() => setOpenClock(false)} /> : null}
        </div>
      </div>
    </header>
  );
}

function AppMenu({ onOpen }: { onOpen: (app: WorkspaceApp) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className="rounded-md px-2 py-1 text-[0.8125rem] font-semibold text-white can-hover:hover:bg-white/10"
        onClick={() => setOpen((v) => !v)}
      >
        Workspace
      </button>
      {open ? (
        <ul className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-md bg-ink-900/95 p-1 text-white shadow-lg ring-1 ring-white/15">
          {(["meet", "files", "calendar", "chat"] as const).map((app) => (
            <li key={app}>
              <button
                type="button"
                className="w-full rounded-sm px-3 py-1.5 text-left text-[0.8125rem] capitalize can-hover:hover:bg-white/10"
                onClick={() => {
                  onOpen(app);
                  setOpen(false);
                }}
              >
                {app === "files" ? "File Station" : app}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ClockPopover({ onClose }: { onClose: () => void }) {
  const today = colomboDayKey(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const days = useMemo(() => monthGrid(new Date()), []);

  useEffect(() => {
    browserApi<Appointment[]>("/appointments?per_page=50&status=confirmed")
      .then((data) => setAppointments((Array.isArray(data) ? data : []).filter((a) => colomboDayKey(a.start_at || "") === today)))
      .catch(() => setAppointments([]));
  }, [today]);

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg bg-ink-900/95 p-3 text-white shadow-lg ring-1 ring-white/15">
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[0.7rem] text-white/50">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
        {days.map((day) => (
          <span
            key={day.key}
            className={
              day.key === today
                ? "rounded-full bg-brand text-on-brand"
                : day.inMonth
                  ? "text-white/80"
                  : "text-white/30"
            }
          >
            {day.label}
          </span>
        ))}
      </div>
      <p className="mb-1 text-[0.7rem] uppercase tracking-wide text-white/50">Today</p>
      {appointments.length === 0 ? (
        <p className="text-[0.8125rem] text-white/60">No visits today.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {appointments.map((a) => (
            <li key={a.id} className="text-[0.8125rem]">
              {formatVisitClock(a.start_at_local || a.start_at)} · {a.counterpart_name || a.patient_name || "Patient"}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="sr-only" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

function monthGrid(now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { key: string; label: number; inMonth: boolean }[] = [];
  for (let i = 0; i < startOffset; i += 1) {
    const d = new Date(year, month, 1 - startOffset + i);
    cells.push({ key: keyOf(d), label: d.getDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month, day);
    cells.push({ key: keyOf(d), label: day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month, daysInMonth + (cells.length - startOffset - daysInMonth) + 1);
    cells.push({ key: keyOf(d), label: d.getDate(), inMonth: false });
  }
  return cells;
}

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
