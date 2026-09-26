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
import { ApiError } from "@/lib/consumer/api/errors";
import type { Holiday, Schedule, ScheduleUpdated } from "@/lib/consumer/api/types";
import { weekdayLabel } from "@/lib/consumer/features/availability";
import {
  DEFAULT_SLOT_MINUTES,
  flattenWorkingHours,
  groupWorkingHours,
  schedulePutBody,
  type TimeWindow,
} from "@/lib/consumer/features/practice";
import { PageHero } from "@/components/consumer/ui/PageHero";
import { HEROES } from "@/lib/consumer/heroes";

const SLOT_OPTIONS = [15, 20, 30];
const BUFFER_OPTIONS = [0, 5, 10, 15];

function withCurrent(options: number[], current: number): number[] {
  return options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
}

export function AvailabilityEditor({
  initialSchedule,
  initialHolidays,
}: {
  initialSchedule: Schedule;
  initialHolidays: Holiday[];
}) {
  const grouped = useMemo(
    () => groupWorkingHours(initialSchedule.workingHours ?? []),
    [initialSchedule],
  );

  const [schedule, setSchedule] = useState<Schedule>(initialSchedule);
  const [windows, setWindows] = useState<Record<number, TimeWindow[]>>(grouped.windows);
  const [available, setAvailable] = useState<Record<number, boolean>>(grouped.available);
  const [slot, setSlot] = useState(initialSchedule.slotDurationMinutes || DEFAULT_SLOT_MINUTES);
  const [buffer, setBuffer] = useState(initialSchedule.bufferMinutes ?? 0);
  const [maxPerDay, setMaxPerDay] = useState(initialSchedule.maxPerDay ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [outsideHours, setOutsideHours] = useState(0);

  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayReason, setHolidayReason] = useState("");
  const [holidayBusy, setHolidayBusy] = useState(false);
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [affected, setAffected] = useState<number | null>(null);

  function toggleDay(day: number, isAvailable: boolean) {
    setAvailable((prev) => ({ ...prev, [day]: isAvailable }));
  }

  function updateWindow(day: number, index: number, field: "start" | "end", value: string) {
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
        const [lastH] = lastWin.end.split(":").map(Number);
        if (lastH != null && !Number.isNaN(lastH)) {
          const startH = Math.min(22, Math.max(lastH + 1, 14));
          const endH = Math.min(23, startH + 3);
          nextStart = `${String(startH).padStart(2, "0")}:00`;
          nextEnd = `${String(endH).padStart(2, "0")}:00`;
        }
      }

      return {
        ...prev,
        [day]: [...dayWins, { start: nextStart, end: nextEnd }],
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
        if (!w.start || !w.end) {
          return `Please specify both start and end time for all shifts on ${weekdayLabel(day)}.`;
        }
        if (w.start >= w.end) {
          return `${weekdayLabel(day)}: End time (${w.end}) must be after start time (${w.start}).`;
        }
      }
      const sorted = [...dayWins].sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (!current || !next) continue;
        if (next.start < current.end) {
          return `${weekdayLabel(day)} has overlapping shifts: ${current.start}–${current.end} and ${next.start}–${next.end}.`;
        }
      }
    }
    return null;
  }

  async function save() {
    setError(null);
    setNotice(null);
    setOutsideHours(0);

    const validationError = validateSchedule();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const updated = await browserApi<ScheduleUpdated>("/doctors/me/schedule", {
        method: "PUT",
        body: schedulePutBody(schedule, {
          hours: flattenWorkingHours(windows, available),
          slotMinutes: slot,
          bufferMinutes: buffer,
          maxPerDay,
        }),
      });
      setSchedule(updated);
      setOutsideHours(updated.appointmentsOutsideNewHours ?? 0);
      setNotice("Schedule saved. Patients see the new slots straight away.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save availability");
    } finally {
      setSaving(false);
    }
  }

  async function addHoliday(cancelBooked: boolean) {
    if (!holidayDate) return;
    setHolidayBusy(true);
    setHolidayError(null);
    try {
      const created = await browserApi<Holiday>("/doctors/me/holidays", {
        method: "POST",
        body: { date: holidayDate, reason: holidayReason.trim() || "Leave", cancelBooked },
      });
      setHolidays((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
      setHolidayDate("");
      setHolidayReason("");
      setAffected(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "appointments_affected") {
        const count = err.body.affectedAppointments;
        setAffected(typeof count === "number" ? count : 1);
      } else {
        setHolidayError(err instanceof Error ? err.message : "Could not add leave day");
      }
    } finally {
      setHolidayBusy(false);
    }
  }

  async function removeHoliday(id: string) {
    setHolidayError(null);
    try {
      await browserApi(`/doctors/me/holidays/${id}`, { method: "DELETE" });
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      setHolidayError(err instanceof Error ? err.message : "Could not remove leave day");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHero {...HEROES.availability} />

      <Card variant="glass" className="grid gap-4 sm:grid-cols-3">
        <Select
          id="slot-duration"
          label="Slot duration"
          value={slot}
          onChange={(e) => setSlot(Number(e.target.value))}
        >
          {withCurrent(SLOT_OPTIONS, slot).map((m) => (
            <option key={m} value={m}>
              {m} minutes
            </option>
          ))}
        </Select>
        <Select
          id="slot-buffer"
          label="Buffer between slots"
          value={buffer}
          onChange={(e) => setBuffer(Number(e.target.value))}
        >
          {withCurrent(BUFFER_OPTIONS, buffer).map((m) => (
            <option key={m} value={m}>
              {m === 0 ? "None (back to back)" : `${m} minutes`}
            </option>
          ))}
        </Select>
        <Input
          id="daily-cap"
          label="Daily appointment cap"
          type="number"
          min={1}
          max={200}
          value={maxPerDay}
          onChange={(e) => setMaxPerDay(Math.max(1, Number(e.target.value) || 1))}
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
                        value={win.start}
                        onChange={(e) => updateWindow(day, winIndex, "start", e.target.value)}
                        className="flex-1"
                      />
                      <span className="shrink-0 text-body-sm text-muted">to</span>
                      <Input
                        type="time"
                        value={win.end}
                        onChange={(e) => updateWindow(day, winIndex, "end", e.target.value)}
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

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {outsideHours > 0 ? (
        <Alert tone="warning">
          {outsideHours} booked {outsideHours === 1 ? "appointment falls" : "appointments fall"} outside
          your new hours. They are still booked; reschedule or cancel them from the queue if needed.
        </Alert>
      ) : null}

      <Button size="lg" className="self-start" busy={saving} onClick={() => void save()}>
        Save schedule
      </Button>

      <Card className="flex flex-col gap-4">
        <h2 className="text-h4 text-ink">Leave days</h2>
        <p className="max-w-prose text-body-sm text-muted">
          No slots are offered on a leave day. If patients are already booked, you are asked
          before their appointments are cancelled and refunded.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            id="leave-date"
            label="Date"
            type="date"
            fieldClassName="sm:flex-1"
            value={holidayDate}
            onChange={(e) => {
              setHolidayDate(e.target.value);
              setAffected(null);
            }}
          />
          <Input
            id="leave-reason"
            label="Reason"
            placeholder="Leave"
            maxLength={500}
            fieldClassName="sm:flex-1"
            value={holidayReason}
            onChange={(e) => setHolidayReason(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            busy={holidayBusy && affected === null}
            disabled={!holidayDate || holidayBusy || affected !== null}
            onClick={() => void addHoliday(false)}
          >
            Add date
          </Button>
        </div>
        {affected !== null ? (
          <Alert tone="warning" title={`${affected} booked ${affected === 1 ? "appointment" : "appointments"} on ${holidayDate}`}>
            <p>Adding this leave day cancels them and refunds the patients in full.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" busy={holidayBusy} onClick={() => void addHoliday(true)}>
                Cancel bookings and add leave
              </Button>
              <Button size="sm" variant="ghost" disabled={holidayBusy} onClick={() => setAffected(null)}>
                Keep bookings
              </Button>
            </div>
          </Alert>
        ) : null}
        {holidayError ? <Alert tone="danger">{holidayError}</Alert> : null}
        {holidays.length ? (
          <ul className="flex flex-wrap gap-2">
            {holidays.map((h) => (
              <li key={h.id} className="inline-flex items-center gap-1">
                <Badge tone="warning">
                  {h.date}
                  {h.reason ? ` · ${h.reason}` : ""}
                  {h.doctorId ? "" : " · platform"}
                </Badge>
                {h.doctorId ? (
                  <button
                    type="button"
                    onClick={() => void removeHoliday(h.id)}
                    className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-[background-color,color,transform] duration-[160ms] ease-out active:scale-[0.94] can-hover:hover:bg-danger-tint can-hover:hover:text-danger"
                    title="Remove leave day"
                    aria-label={`Remove leave on ${h.date}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
