"use client";

import { useState } from "react";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { ScheduleSettings, WorkingHour } from "@/lib/admin/api/types";
import {
  DAYS,
  type DayRow,
  dayError,
  initialBuffer,
  toAvailabilityRequest,
  toRows,
} from "@/lib/admin/schedule";

/**
 * Staff-operated schedule editor.
 *
 * Doctors phone or message their hours to the clinic; this is where an
 * administrator enters them. It deliberately does NOT edit leave — that is
 * scheduling-service's holidays table with its own admin route, and two write
 * paths to one set of rows is how they drift apart.
 */
export function ScheduleEditor({
  doctorId,
  doctorName,
  initialHours,
  initialSettings,
}: {
  doctorId: string;
  doctorName: string;
  initialHours: WorkingHour[];
  initialSettings: ScheduleSettings;
}) {
  const [rows, setRows] = useState<DayRow[]>(() => toRows(initialHours));
  const [slotDuration, setSlotDuration] = useState(initialSettings.slot_duration_minutes || 15);
  // Kept as a string so the field can be genuinely empty. "" means "leave it
  // unset"; "0" means back-to-back, which is a different instruction.
  const [buffer, setBuffer] = useState(() => initialBuffer(initialSettings));
  const [maxPerDay, setMaxPerDay] = useState(initialSettings.max_per_day || 0);

  const errors = rows.map(dayError);
  const hasError = errors.some((e) => e !== null);
  const anyDayOn = rows.some((r) => r.available);

  const mutation = useApiMutation<WorkingHour[], void>({
    method: "PUT",
    path: () => endpoints.doctorSchedule.availability(doctorId),
    body: () => toAvailabilityRequest(rows, slotDuration, buffer, maxPerDay),
    successMessage: () => `Saved ${doctorName}'s hours. New slots follow this pattern.`,
  });

  function setRow(day: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((r, i) => (i === day ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {rows.map((row, i) => {
          const day = DAYS[i] ?? `Day ${i}`;
          const error = errors[i];
          return (
            <div key={day} className="flex flex-wrap items-center gap-3">
              <div className="flex w-40 items-center gap-2">
                <Switch
                  id={`day-${i}`}
                  checked={row.available}
                  onCheckedChange={(on) => setRow(i, { available: on })}
                  aria-label={`${day} available`}
                />
                <Label htmlFor={`day-${i}`} className="cursor-pointer">
                  {day}
                </Label>
              </div>

              {row.available ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="time"
                    value={row.start}
                    onChange={(e) => setRow(i, { start: e.target.value })}
                    className="w-32"
                    aria-label={`${day} start time`}
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input
                    type="time"
                    value={row.end}
                    onChange={(e) => setRow(i, { end: e.target.value })}
                    className="w-32"
                    aria-label={`${day} end time`}
                  />
                  {error ? <span className="text-destructive text-sm">{error}</span> : null}
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">Not working</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="slot-duration">Consultation length (minutes)</Label>
          <Input
            id="slot-duration"
            type="number"
            min={5}
            max={240}
            value={slotDuration}
            onChange={(e) => setSlotDuration(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="buffer">Gap between consultations</Label>
          <Input
            id="buffer"
            type="number"
            min={0}
            max={120}
            value={buffer}
            placeholder="Not set"
            onChange={(e) => setBuffer(e.target.value)}
          />
          <p className="text-muted-foreground text-sm">
            Enter 0 for back-to-back. Leave blank to use the platform default.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-per-day">Maximum per day</Label>
          <Input
            id="max-per-day"
            type="number"
            min={0}
            max={100}
            value={maxPerDay}
            onChange={(e) => setMaxPerDay(Number(e.target.value))}
          />
          <p className="text-muted-foreground text-sm">0 means no limit.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button disabled={hasError || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Saving…" : "Save hours"}
        </Button>
        {!anyDayOn ? (
          <span className="text-muted-foreground text-sm">
            Every day is off, so no new slots will be generated.
          </span>
        ) : null}
      </div>

      <p className="text-muted-foreground text-sm">
        This sets the weekly pattern. Individual days off are recorded as leave,
        which is managed separately from the appointments screen.
      </p>
    </div>
  );
}
