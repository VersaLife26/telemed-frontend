import Link from "next/link";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  DASHBOARD_MAX_RANGE_DAYS,
  DASHBOARD_PRESET_DAYS,
  type DashboardPresetDays,
  colomboToday,
  dashboardRangeHref,
  presetRange,
} from "@/lib/admin/dashboard/date-range";
import { cn } from "@/lib/admin/utils";

/**
 * Dashboard date controls: quick ranges plus an explicit from/to picker.
 *
 * Everything is plain links or a GET form so the dashboard stays a server
 * component and never suspends on client search params.
 */
export function DashboardRangeControls({
  from,
  to,
  activePreset,
}: {
  from: string;
  to: string;
  activePreset: DashboardPresetDays | null;
}) {
  const today = colomboToday();

  return (
    <div className="flex w-full max-w-xl flex-col gap-3 sm:w-auto sm:items-end">
      <div
        role="radiogroup"
        aria-label="Quick date range"
        className="inline-flex flex-wrap items-center gap-1 self-end rounded-lg border border-border p-1"
      >
        {DASHBOARD_PRESET_DAYS.map((days) => {
          const active = activePreset === days;
          const preset = presetRange(days, today);
          const href = dashboardRangeHref(preset.from, preset.to);
          return (
            <Link
              key={days}
              href={href}
              role="radio"
              aria-checked={active}
              className={cn(
                "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {days} days
            </Link>
          );
        })}
      </div>

      <form
        method="get"
        action="/"
        className="flex flex-wrap items-end justify-end gap-2 rounded-lg border border-border bg-card/60 p-2"
      >
        <div className="space-y-1">
          <Label htmlFor="dashboard-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="dashboard-from"
            name="from"
            type="date"
            required
            defaultValue={from}
            max={to}
            className="h-9 w-[11.5rem]"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dashboard-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="dashboard-to"
            name="to"
            type="date"
            required
            defaultValue={to}
            min={from}
            max={today}
            className="h-9 w-[11.5rem]"
          />
        </div>
        <Button type="submit" size="sm" className="h-9 shrink-0">
          Apply
        </Button>
        <p className="w-full text-right text-[11px] text-muted-foreground">
          Pick one day by setting the same from and to. Ranges can span up to{" "}
          {DASHBOARD_MAX_RANGE_DAYS} days (Colombo calendar).
        </p>
      </form>
    </div>
  );
}

/** @deprecated Use {@link DashboardRangeControls}. */
export function RangePickerLinks({
  current,
  options,
}: {
  current: number;
  options: readonly number[];
}) {
  const today = colomboToday();
  const preset =
    (options as readonly number[]).includes(current) && current > 0
      ? presetRange(current as DashboardPresetDays, today)
      : presetRange(30, today);

  return (
    <DashboardRangeControls
      from={preset.from}
      to={preset.to}
      activePreset={
        (DASHBOARD_PRESET_DAYS as readonly number[]).includes(current)
          ? (current as DashboardPresetDays)
          : null
      }
    />
  );
}
