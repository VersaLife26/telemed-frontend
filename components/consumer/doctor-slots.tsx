"use client";

import Link from "next/link";
import { useState } from "react";

import type { Slot } from "@/lib/consumer/api/types";
import { cx } from "@/lib/consumer/cx";
import { dayKeyLabel, dayKeyWeekday } from "@/lib/consumer/features/calendar";
import { formatVisitClock } from "@/lib/consumer/features/patient-appointment";
import { firstOpenDay } from "@/lib/consumer/features/slots";

export type SlotDay = { date: string; slots: Slot[] };

export function DoctorSlotPicker({
  doctorId,
  today,
  days,
}: {
  doctorId: string;
  today: string;
  days: SlotDay[];
}) {
  const [selected, setSelected] = useState(() => firstOpenDay(days) ?? today);
  const day = days.find((entry) => entry.date === selected) ?? days[0];
  const open = day?.slots ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {days.map((entry) => {
          const active = entry.date === selected;
          const count = entry.slots.length;
          const isToday = entry.date === today;
          return (
            <button
              key={entry.date}
              type="button"
              onClick={() => setSelected(entry.date)}
              className={cx(
                "flex min-w-[4.25rem] shrink-0 flex-col items-center rounded-xl border px-2.5 py-2 transition-[background-color,border-color,color,transform] duration-[160ms] ease-out active:scale-[0.97]",
                active
                  ? "border-brand bg-brand text-on-brand shadow-brand"
                  : count > 0
                    ? "border-border-default bg-surface text-ink can-hover:hover:border-brand"
                    : "border-border-subtle bg-tint text-muted",
              )}
            >
              <span className="text-[0.6875rem] font-medium uppercase tracking-wide">
                {isToday ? "Today" : dayKeyWeekday(entry.date)}
              </span>
              <span className="text-label tabular-nums">{dayKeyLabel(entry.date)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {open.map((slot) => {
          const when = slot.start_at_local || slot.start_at;
          const clock = formatVisitClock(when);
          return (
            <Link
              key={slot.id}
              href={`/doctors/${doctorId}/intake?slot_id=${slot.id}&start=${encodeURIComponent(when || "")}`}
              className="inline-flex min-h-11 min-w-20 items-center justify-center rounded-pill border border-border-default bg-surface px-4 text-label text-ink tabular-time transition-[background-color,border-color,color,transform] duration-[160ms] ease-out active:scale-[0.97] can-hover:hover:border-brand can-hover:hover:bg-brand can-hover:hover:text-on-brand"
            >
              {clock !== "—" ? clock : slot.id.slice(0, 8)}
            </Link>
          );
        })}
        {open.length === 0 ? (
          <p className="text-body-sm text-muted">
            {selected === today ? "No open slots for today." : "No open slots on this day."}
          </p>
        ) : null}
      </div>

      {open.length > 0 ? (
        <p className="text-body-sm text-muted">Choose a time to continue to intake.</p>
      ) : null}
    </div>
  );
}
