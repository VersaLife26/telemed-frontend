import { Skeleton } from "@/components/admin/ui/skeleton";

/**
 * The loading state for every table in the console.
 *
 * It reserves the real number of columns and a plausible number of rows so the
 * page does not reflow when data lands. `aria-busy` plus a polite live region
 * is what a screen reader hears; the rectangles themselves are hidden from it.
 */
export function TableSkeleton({
  columns,
  rows = 8,
  label = "Loading table data",
}: {
  columns: number;
  rows?: number;
  label?: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="overflow-hidden rounded-lg border border-border"
    >
      <span className="sr-only">{label}</span>
      <div className="border-b border-border bg-muted/40 px-3 py-2.5">
        <div className="flex gap-4">
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={index} className="h-3 flex-1" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 px-3 py-3">
            {Array.from({ length: columns }, (_, colIndex) => (
              <Skeleton
                key={colIndex}
                className="h-4 flex-1"
                // Vary the widths slightly so it reads as content rather than
                // as a loading bar.
                style={{ maxWidth: colIndex === 0 ? "18%" : undefined }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Card-shaped skeleton for dashboard tiles and charts. */
export function CardSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="rounded-xl border border-border p-6"
      style={{ minHeight: height }}
    >
      <span className="sr-only">Loading</span>
      <Skeleton className="mb-4 h-4 w-40" />
      <Skeleton className="h-[calc(100%-2rem)] w-full" style={{ height: height - 80 }} />
    </div>
  );
}
