"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { browserApi } from "@/lib/consumer/api/client";
import type { WorkingHour } from "@/lib/consumer/api/types";
import { weekdayLabel } from "@/lib/consumer/features/availability";
import {
  DEFAULT_SLOT_MINUTES,
  availabilityPutBody,
  fillWorkingHours,
  type ScheduleSettings,
} from "@/lib/consumer/features/practice";

type HourDraft = WorkingHour;

export function AvailabilityEditor({
  initialHours,
  initialSettings,
}: {
  initialHours: WorkingHour[];
  initialSettings: ScheduleSettings | null;
}) {
  const seeded = useMemo(() => fillWorkingHours(initialHours), [initialHours]);

  const [hours, setHours] = useState<HourDraft[]>(seeded);
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

  function patchHour(index: number, next: Partial<HourDraft>) {
    setHours((prev) => prev.map((row, i) => (i === index ? { ...row, ...next } : row)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await browserApi("/doctors/me/availability", {
        method: "PUT",
        body: availabilityPutBody({
          hours,
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

      {hours.map((h, index) => (
        <Card key={h.day_of_week} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 sm:w-36">
            <input
              type="checkbox"
              checked={h.is_available}
              onChange={(e) => patchHour(index, { is_available: e.target.checked })}
            />
            <span className="text-body font-medium text-black">{weekdayLabel(h.day_of_week)}</span>
          </label>
          <Input
            type="time"
            value={h.start_time.slice(0, 5)}
            disabled={!h.is_available}
            onChange={(e) => patchHour(index, { start_time: e.target.value })}
          />
          <Input
            type="time"
            value={h.end_time.slice(0, 5)}
            disabled={!h.is_available}
            onChange={(e) => patchHour(index, { end_time: e.target.value })}
          />
        </Card>
      ))}

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
