"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { Button } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { Input } from "@/components/consumer/ui/Input";
import { Select } from "@/components/consumer/ui/Select";
import { Switch } from "@/components/consumer/ui/Switch";
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
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-h2 text-ink">Working hours</h1>
        <p className="mt-1 max-w-prose text-body-lg text-muted">
          Asia/Colombo. Slot length, buffer and daily cap save with the week. Leave dates are
          additive — they do not replace previous leave.
        </p>
      </header>

      <Card variant="glass" className="grid gap-4 sm:grid-cols-3">
        <Select
          id="slot-duration"
          label="Slot duration"
          value={slot}
          onChange={(e) => setSlot(Number(e.target.value))}
        >
          <option value={15}>15 minutes</option>
          <option value={20}>20 minutes</option>
          <option value={30}>30 minutes</option>
        </Select>
        <Select
          id="slot-buffer"
          label="Buffer between slots"
          value={buffer}
          onChange={(e) => setBuffer(e.target.value)}
        >
          <option value="">Platform default</option>
          <option value="0">None (back to back)</option>
          <option value="5">5 minutes</option>
          <option value="10">10 minutes</option>
          <option value="15">15 minutes</option>
        </Select>
        <Input
          id="daily-cap"
          label="Daily appointment cap"
          hint="0 means no cap."
          type="number"
          min={0}
          max={100}
          value={maxPerDay}
          onChange={(e) => setMaxPerDay(Number(e.target.value) || 0)}
        />
      </Card>

      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
        const isDayAvailable = available[day] ?? false;
        const dayWins = windows[day] ?? [];

        return (
          <Card key={day} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <Switch
                checked={isDayAvailable}
                onChange={(next) => toggleDay(day, next)}
                label={weekdayLabel(day)}
                className="flex-1"
              />
              {!isDayAvailable ? <Badge>Unavailable</Badge> : null}
            </div>

            {isDayAvailable && (
              <div className="flex flex-col gap-3 pl-0 sm:pl-6">
                {dayWins.map((win, winIndex) => (
                  <div key={winIndex} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="shrink-0 text-body-sm text-muted sm:w-24">
                      {dayWins.length > 1 ? `Shift ${winIndex + 1}` : "Hours"}
                    </span>
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        type="time"
                        value={win.start_time}
                        onChange={(e) => updateWindow(day, winIndex, "start_time", e.target.value)}
                        className="flex-1"
                      />
                      <span className="shrink-0 text-body-sm text-muted">to</span>
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
                        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-[background-color,color,transform] duration-[160ms] ease-out active:scale-[0.94] can-hover:hover:bg-danger-tint can-hover:hover:text-danger"
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
                    className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-label text-brand underline-offset-4 can-hover:hover:underline"
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

      <Card className="flex flex-col gap-4">
        <h2 className="text-h4 text-ink">Leave days</h2>
        <p className="max-w-prose text-body-sm text-muted">
          Adds blackout dates. If patients are already booked, save is refused unless you
          cancel those bookings separately.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            id="leave-date"
            label="Date"
            type="date"
            fieldClassName="sm:flex-1"
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
          />
          <Input
            id="leave-reason"
            label="Reason"
            placeholder="Optional"
            fieldClassName="sm:flex-1"
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
        {holidays.length ? (
          <ul className="flex flex-wrap gap-2">
            {holidays.map((h) => (
              <li key={h.date}>
                <Badge tone="warning">
                  {h.date}
                  {h.reason ? ` · ${h.reason}` : ""}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <Button size="lg" className="self-start" busy={saving} onClick={() => void save()}>
        Save schedule
      </Button>
    </div>
  );
}
