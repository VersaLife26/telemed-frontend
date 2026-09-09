"use client";

import * as React from "react";

/**
 * Tooltip body shared by every chart.
 *
 * Recharts' default tooltip renders inline styles that ignore the theme and a
 * raw numeric value that ignores the fact that everything here is either cents
 * or a count. Both matter: an admin reading "125000" instead of "LKR 1,250.00"
 * has to do the division in their head, every time.
 */
export function ChartTooltipBody({
  label,
  rows,
}: {
  label: string;
  rows: Array<{ key: string; label: string; value: string; color: string }>;
}) {
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">{label}</p>
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: row.color }}
            />
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto font-medium tabular-nums text-popover-foreground">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
