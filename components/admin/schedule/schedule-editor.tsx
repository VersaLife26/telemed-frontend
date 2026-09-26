"use client";

import { useState } from "react";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import { endpoints } from "@/lib/admin/api/endpoints";
import { type ApiError, hasCode } from "@/lib/admin/api/errors";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { Holiday, Schedule, ScheduleUpdated, SlotBlock } from "@/lib/admin/api/types";
import {
  DAYS,
  type DayRow,
  type ScheduleSettings,
  dayError,
  initialSettings,
  toRows,
  toScheduleRequest,
} from "@/lib/admin/schedule";

/**
 * Staff-operated schedule editor.
 *
 * Doctors phone or message their hours to the clinic; this is where an
 * administrator enters them. Leave and one-off blocks are separate resources
 * with their own forms below, because the weekly pattern replaces the whole
 * week on every save and must not carry them.
 */
export function ScheduleEditor({
  doctorId,
  doctorName,
  initialSchedule,
}: {
  doctorId: string;
  doctorName: string;
  initialSchedule: Schedule;
}) {
  const [rows, setRows] = useState<DayRow[]>(() => toRows(initialSchedule.workingHours ?? []));
  const [settings, setSettings] = useState<ScheduleSettings>(() => initialSettings(initialSchedule));
  const setSetting = (patch: Partial<ScheduleSettings>) => setSettings((prev) => ({ ...prev, ...patch }));

  const errors = rows.map(dayError);
  const hasError = errors.some((e) => e !== null);
  const anyDayOn = rows.some((r) => r.available);

  const mutation = useApiMutation<ScheduleUpdated, void>({
    method: "PUT",
    path: () => endpoints.doctorSchedule.schedule(doctorId),
    body: () => toScheduleRequest(rows, settings),
    successMessage: (result) => {
      const outside = result.appointmentsOutsideNewHours ?? 0;
      return outside > 0
        ? `Saved ${doctorName}'s hours. ${outside} booked appointment${outside === 1 ? " falls" : "s fall"} outside them and ${outside === 1 ? "is" : "are"} unchanged.`
        : `Saved ${doctorName}'s hours. Bookable times follow this pattern straight away.`;
    },
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

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="slot-duration">Consultation length (minutes)</Label>
          <Input
            id="slot-duration"
            type="number"
            min={5}
            max={240}
            value={settings.slotDurationMinutes}
            onChange={(e) => setSetting({ slotDurationMinutes: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="buffer">Gap between consultations</Label>
          <Input
            id="buffer"
            type="number"
            min={0}
            max={120}
            value={settings.bufferMinutes}
            onChange={(e) => setSetting({ bufferMinutes: Number(e.target.value) })}
          />
          <p className="text-muted-foreground text-sm">Enter 0 for back-to-back.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-per-day">Maximum per day</Label>
          <Input
            id="max-per-day"
            type="number"
            min={0}
            max={100}
            value={settings.maxPerDay}
            onChange={(e) => setSetting({ maxPerDay: Number(e.target.value) })}
          />
          <p className="text-muted-foreground text-sm">0 means no limit.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="advance-days">Bookable ahead (days)</Label>
          <Input
            id="advance-days"
            type="number"
            min={1}
            max={365}
            value={settings.advanceDays}
            onChange={(e) => setSetting({ advanceDays: Number(e.target.value) })}
          />
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Times are in the doctor&rsquo;s time zone, {settings.timezone}.
      </p>

      <div className="flex items-center gap-3">
        <Button disabled={hasError || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Saving…" : "Save hours"}
        </Button>
        {!anyDayOn ? (
          <span className="text-muted-foreground text-sm">
            Every day is off, so this doctor will have no bookable times.
          </span>
        ) : null}
      </div>

      <p className="text-muted-foreground text-sm">
        This sets the weekly pattern. Use the leave form below for a single day off.
      </p>

      <HolidayForm doctorId={doctorId} />
      <SlotBlockForm doctorId={doctorId} />
    </div>
  );
}

/** The count the API puts on a `409 appointments_affected`, or null for any other failure. */
function affectedCount(error: ApiError | null): number | null {
  if (!hasCode(error, "appointments_affected")) return null;
  const count = error?.body.affectedAppointments;
  return typeof count === "number" ? count : 0;
}

function AffectedPrompt({
  count,
  what,
  pending,
  onConfirm,
}: {
  count: number;
  what: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
      <p>
        {count} booked appointment{count === 1 ? " is" : "s are"} affected by this {what}.
        Saving anyway cancels {count === 1 ? "it" : "them"} with a full refund.
      </p>
      <Button variant="destructive" size="sm" disabled={pending} onClick={onConfirm}>
        Cancel {count === 1 ? "it" : "them"} and save
      </Button>
    </div>
  );
}

function HolidayForm({ doctorId }: { doctorId: string }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useApiMutation<Holiday, { cancelBooked: boolean }>({
    method: "POST",
    path: () => endpoints.doctorSchedule.holidays(doctorId),
    body: ({ cancelBooked }) => ({ date, reason: reason.trim(), cancelBooked }),
    successMessage: () => "Leave recorded. That day is no longer bookable.",
    onSuccess: () => {
      setDate("");
      setReason("");
    },
  });
  const affected = affectedCount(mutation.error);

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium">Record leave</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="leave-date">Date</Label>
          <Input id="leave-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="leave-reason">Reason</Label>
          <Input
            id="leave-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
          />
        </div>
      </div>
      {affected !== null ? (
        <AffectedPrompt
          count={affected}
          what="leave"
          pending={mutation.isPending}
          onConfirm={() => mutation.mutate({ cancelBooked: true })}
        />
      ) : null}
      <Button
        variant="outline"
        disabled={!date || reason.trim().length === 0 || mutation.isPending}
        onClick={() => mutation.mutate({ cancelBooked: false })}
      >
        Save leave
      </Button>
    </div>
  );
}

function SlotBlockForm({ doctorId }: { doctorId: string }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useApiMutation<SlotBlock, { cancelBooked: boolean }>({
    method: "POST",
    path: () => endpoints.doctorSchedule.slotBlocks(doctorId),
    // datetime-local carries no zone; it is read in the browser's own zone.
    body: ({ cancelBooked }) => ({
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
      reason: reason.trim(),
      cancelBooked,
    }),
    successMessage: () => "Time blocked. It is no longer bookable.",
    onSuccess: () => {
      setStart("");
      setEnd("");
      setReason("");
    },
  });
  const affected = affectedCount(mutation.error);

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium">Block a period</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="block-start">From (your local time)</Label>
          <Input
            id="block-start"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="block-end">To</Label>
          <Input
            id="block-end"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="block-reason">Reason</Label>
          <Input id="block-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      {affected !== null ? (
        <AffectedPrompt
          count={affected}
          what="block"
          pending={mutation.isPending}
          onConfirm={() => mutation.mutate({ cancelBooked: true })}
        />
      ) : null}
      <Button
        variant="outline"
        disabled={!start || !end || start >= end || reason.trim().length === 0 || mutation.isPending}
        onClick={() => mutation.mutate({ cancelBooked: false })}
      >
        Block period
      </Button>
    </div>
  );
}
