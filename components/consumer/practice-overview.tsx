import { CalendarCheck, CheckCircle2, UserX, XCircle } from "lucide-react";

import { Card } from "@/components/consumer/ui/Card";
import { StatCard } from "@/components/consumer/ui/StatCard";
import type { DoctorAnalytics, PeakHour } from "@/lib/consumer/api/types";
import {
  busiestCell,
  busiestLabel,
  cancellationRate,
  formatRate,
  peakGrid,
} from "@/lib/consumer/features/practice";
import { WEEKDAYS } from "@/lib/consumer/features/availability";

export function PracticeOverview({
  summary,
  peak,
}: {
  summary: DoctorAnalytics | null;
  peak: PeakHour[] | null;
}) {
  const grid = peakGrid(peak);
  const max = Math.max(1, ...grid.flat());

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<CalendarCheck className="size-5" />}
          value={summary?.completed ?? 0}
          label="Completed consults"
          trend={summary?.from && summary?.to ? `${summary.from} → ${summary.to}` : undefined}
        />
        <StatCard
          icon={<UserX className="size-5" />}
          value={formatRate(summary?.noShowRate)}
          label="No-show rate"
        />
        <StatCard
          icon={<XCircle className="size-5" />}
          value={formatRate(cancellationRate(summary))}
          label="Cancellation rate"
        />
        <StatCard
          icon={<CheckCircle2 className="size-5" />}
          value={formatRate(summary?.completionRate)}
          label="Completion rate"
        />
      </div>

      <Card className="overflow-x-auto">
        <h2 className="text-h4 text-ink">Peak hours</h2>
        <p className="mt-1 text-body-sm text-muted">
          {busiestLabel(busiestCell(peak))}
        </p>
        <div className="mt-5 min-w-[640px]">
          <div className="grid grid-cols-[48px_repeat(24,minmax(0,1fr))] gap-0.5">
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="text-center text-[10px] text-faint tabular-time">
                {hour}
              </span>
            ))}
            {WEEKDAYS.map((day, dayIndex) => (
              <PeakRow key={day} day={day} cells={grid[dayIndex] ?? []} max={max} />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function PeakRow({ day, cells, max }: { day: string; cells: number[]; max: number }) {
  return (
    <>
      <span className="text-body-sm text-muted">{day}</span>
      {cells.map((count, hour) => (
        <span
          key={hour}
          title={`${day} ${String(hour).padStart(2, "0")}:00 · ${count}`}
          // Opacity rather than a colour ramp: one hue, so the eye reads
          // density instead of trying to decode a legend.
          className="block h-4 rounded-[3px] bg-brand"
          style={{ opacity: count === 0 ? 0.08 : 0.2 + (count / max) * 0.8 }}
        />
      ))}
    </>
  );
}
