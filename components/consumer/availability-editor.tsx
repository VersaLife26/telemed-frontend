"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { browserApi } from "@/lib/consumer/api/client";
import type { WorkingHour } from "@/lib/consumer/api/types";
import { weekdayLabel } from "@/lib/consumer/features/availability";
import {
  DEFAULT_SLOT_MINUTES,
  availabilityPutBody,
  flattenWorkingHours,
  groupWorkingHours,
  type ScheduleSettings,
  type TimeWindow,
} from "@/lib/consumer/features/practice";

export function AvailabilityEditor({
  initialHours,
  initialSettings,
}: {
  initialHours: WorkingHour[];
  initialSettings: ScheduleSettings | null;
}) {
  const grouped = useMemo(() => groupWorkingHours(initialHours), [initialHours]);

  const [windows, setWindows] = useState<Record<number, TimeWindow[]>>(grouped.windows);
  const [available, setAvailable] = useState<Record<number, boolean>>(grouped.available);
  const [slot, setSlot] = useState(
    initialSettings?.slot_duration_minutes || DEFAULT_SLOT_MINUTES,
  );
  const [buffer, setBuffer] = useState<string>(
    initialSettings?.buffer_minutes == null ? "" : String(initialSettings.buffer_minutes),
  );
  const [maxPerDay, setMaxPerDay] = useState(initialSettings?.max_per_day ?? 0);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayReason, setHolidayReason] = useState("");
  const [holidays, setHolidays] = useState<Array<{ date: string; reason: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function toggleDay(day: number, isAvailable: boolean) {
    setAvailable((prev) => ({ ...prev, [day]: isAvailable }));
  }

  function updateWindow(day: number, index: number, field: "start_time" | "end_time", value: string) {
    setWindows((prev) => ({
      ...prev,
      [day]: (prev[day] ?? []).map((w, i) => (i === index ? { ...w, [field]: value } : w)),
    }));
  }

  function addWindow(day: number) {
    setWindows((prev) => {
      const dayWins = prev[day] ?? [];
      const lastWin = dayWins[dayWins.length - 1];
      let nextStart = "17:00";
      let nextEnd = "21:00";

      if (lastWin) {
        const [lastH] = lastWin.end_time.split(":").map(Number);
        if (lastH != null && !Number.isNaN(lastH)) {
          const startH = Math.min(22, Math.max(lastH + 1, 14));
          const endH = Math.min(23, startH + 3);
          nextStart = `${String(startH).padStart(2, "0")}:00`;
          nextEnd = `${String(endH).padStart(2, "0")}:00`;
        }
      }

      return {
        ...prev,
        [day]: [...dayWins, { start_time: nextStart, end_time: nextEnd }],
      };
    });
  }

  function removeWindow(day: number, index: number) {
    setWindows((prev) => {
      const dayWins = prev[day] ?? [];
      if (dayWins.length <= 1) return prev;
      return {
        ...prev,
        [day]: dayWins.filter((_, i) => i !== index),
      };
    });
  }

  function validateSchedule(): string | null {
    for (let day = 0; day <= 6; day++) {
      if (!available[day]) continue;
      const dayWins = windows[day] ?? [];
      if (dayWins.length === 0) {
        return `Please add at least one shift for ${weekdayLabel(day)}, or mark it unavailable.`;
      }
      for (const w of dayWins) {
        if (!w.start_time || !w.end_time) {
          return `Please specify both start and end time for all shifts on ${weekdayLabel(day)}.`;
        }
        if (w.start_time >= w.end_time) {
          return `${weekdayLabel(day)}: End time (${w.end_time}) must be after start time (${w.start_time}).`;
        }
      }
      const sorted = [...dayWins].sort((a, b) => a.start_time.localeCompare(b.start_time));
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (!current || !next) continue;
        if (next.start_time < current.end_time) {
          return `${weekdayLabel(day)} has overlapping shifts: ${current.start_time}–${current.end_time} and ${next.start_time}–${next.end_time}.`;
        }
        if (next.start_time === current.start_time) {
          return `${weekdayLabel(day)} has shifts with duplicate start times (${current.start_time}).`;
        }
      }
    }
    return null;
  }

  async function save() {
    setError(null);
    setNotice(null);

    const validationError = validateSchedule();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const flattenedHours = flattenWorkingHours(windows, available);
      await browserApi("/doctors/me/availability", {
        method: "PUT",
        body: availabilityPutBody({
          hours: flattenedHours,
          slotMinutes: slot,
          buffer,
          maxPerDay,
          holidays,
        }),
      });
      setNotice("Schedule saved. New slots generate from these hours.");
      setHolidays([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save availability");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h1 className="text-h4 text-black">Working hours</h1>
        <p className="text-body-sm text-text-muted">
          Asia/Colombo. Slot length, buffer and daily cap save with the week.
          Leave dates are additive — they do not replace previous leave.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex flex-col gap-2">
          <label className="text-body-sm text-text-label">Slot duration</label>
          <select
            className="min-h-12 rounded-[32px] border border-transparent bg-paper px-6 text-[16px]"
            value={slot}
            onChange={(e) => setSlot(Number(e.target.value))}
          >
            <option value={15}>15 minutes</option>
            <option value={20}>20 minutes</option>
            <option value={30}>30 minutes</option>
          </select>
        </Card>
        <Card className="flex flex-col gap-2">
          <label className="text-body-sm text-text-label">Buffer between slots</label>
          <select
            className="min-h-12 rounded-[32px] border border-transparent bg-paper px-6 text-[16px]"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
          >
            <option value="">Platform default</option>
            <option value="0">None (back to back)</option>
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
          </select>
        </Card>
        <Card className="flex flex-col gap-2">
          <label className="text-body-sm text-text-label">Daily appointment cap</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={maxPerDay}
            onChange={(e) => setMaxPerDay(Number(e.target.value) || 0)}
          />
          <p className="text-body-sm text-text-muted">0 means no cap.</p>
        </Card>
      </div>

      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
        const isDayAvailable = available[day] ?? false;
        const dayWins = windows[day] ?? [];

        return (
          <Card key={day} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 sm:w-36 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDayAvailable}
                  onChange={(e) => toggleDay(day, e.target.checked)}
                  className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-body font-medium text-black">{weekdayLabel(day)}</span>
              </label>
              {!isDayAvailable && (
                <span className="text-body-sm text-text-muted">Unavailable</span>
              )}
            </div>

            {isDayAvailable && (
              <div className="flex flex-col gap-3 pl-0 sm:pl-6">
                {dayWins.map((win, winIndex) => (
                  <div key={winIndex} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="text-body-sm text-text-muted sm:w-24 shrink-0">
                      {dayWins.length > 1 ? `Shift ${winIndex + 1}` : "Hours"}
                    </span>
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        type="time"
                        value={win.start_time}
                        onChange={(e) => updateWindow(day, winIndex, "start_time", e.target.value)}
                        className="flex-1"
                      />
                      <span className="text-text-muted text-body-sm shrink-0">to</span>
                      <Input
                        type="time"
                        value={win.end_time}
                        onChange={(e) => updateWindow(day, winIndex, "end_time", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    {dayWins.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWindow(day, winIndex)}
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                        title="Remove shift"
                        aria-label={`Remove shift ${winIndex + 1} for ${weekdayLabel(day)}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => addWindow(day)}
                    className="inline-flex items-center gap-1.5 text-body-sm font-medium text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="size-4" />
                    <span>Add Shift (Morning / Evening Window)</span>
                  </button>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      <Card className="flex flex-col gap-3">
        <p className="text-h5 text-black">Leave days</p>
        <p className="text-body-sm text-text-muted">
          Adds blackout dates. If patients are already booked, save is refused unless you
          cancel those bookings separately.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
          <Input
            placeholder="Reason (optional)"
            value={holidayReason}
            onChange={(e) => setHolidayReason(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!holidayDate) return;
              setHolidays((prev) =>
                prev.some((h) => h.date === holidayDate)
                  ? prev
                  : [...prev, { date: holidayDate, reason: holidayReason.trim() }],
              );
              setHolidayDate("");
              setHolidayReason("");
            }}
          >
            Add date
          </Button>
        </div>
        {holidays.map((h) => (
          <p key={h.date} className="text-body-sm text-text-muted">
            {h.date}
            {h.reason ? ` · ${h.reason}` : ""}
          </p>
        ))}
      </Card>

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      {notice ? <p className="text-body-sm text-primary">{notice}</p> : null}
      <Button type="button" onClick={() => void save()} disabled={saving}>
        {saving ? "Saving…" : "Save schedule"}
      </Button>
    </div>
  );
}
