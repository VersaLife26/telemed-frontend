import { Card } from "@/components/consumer/layout/AppShell";
import type { PeakHours, PracticeSummary } from "@/lib/consumer/features/practice";
import { busiestLabel, formatRate, peakGrid } from "@/lib/consumer/features/practice";
import { WEEKDAYS } from "@/lib/consumer/features/availability";

export function PracticeOverview({
  summary,
  peak,
}: {
  summary: PracticeSummary | null;
  peak: PeakHours | null;
}) {
  const grid = peakGrid(peak?.by_hour_of_week);
  const max = Math.max(1, ...grid.flat());

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-body-sm text-text-label">Completed consults</p>
          <p className="mt-2 text-h4 text-black">{summary?.sessions ?? 0}</p>
          <p className="mt-1 text-body-sm text-text-muted">
            {summary?.from && summary?.to ? `${summary.from} → ${summary.to}` : "This window"}
          </p>
        </Card>
        <Card>
          <p className="text-body-sm text-text-label">No-show rate</p>
          <p className="mt-2 text-h4 text-black">{formatRate(summary?.no_show_rate)}</p>
        </Card>
        <Card>
          <p className="text-body-sm text-text-label">Cancellation rate</p>
          <p className="mt-2 text-h4 text-black">{formatRate(summary?.cancellation_rate)}</p>
        </Card>
        <Card>
          <p className="text-body-sm text-text-label">Rating</p>
          <p className="mt-2 text-h4 text-black">
            {summary?.average_rating != null ? summary.average_rating.toFixed(1) : "—"}
          </p>
          <p className="mt-1 text-body-sm text-text-muted">
            {summary?.review_count ?? 0} reviews in window
          </p>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <p className="text-h5 text-black">Peak hours</p>
        <p className="mt-1 text-body-sm text-text-muted">
          {busiestLabel(peak?.busiest ?? undefined)}
          {peak?.timezone ? ` · ${peak.timezone}` : ""}
        </p>
        <div className="mt-4 min-w-[640px]">
          <div className="grid grid-cols-[48px_repeat(24,minmax(0,1fr))] gap-0.5">
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="text-center text-[10px] text-text-muted">
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
      <span className="text-body-sm text-text-label">{day}</span>
      {cells.map((count, hour) => {
        const intensity = count / max;
        return (
          <span
            key={hour}
            title={`${day} ${String(hour).padStart(2, "0")}:00 · ${count}`}
            className="block h-4 rounded-[2px] bg-primary"
            style={{ opacity: count === 0 ? 0.08 : 0.2 + intensity * 0.8 }}
          />
        );
      })}
    </>
  );
}
