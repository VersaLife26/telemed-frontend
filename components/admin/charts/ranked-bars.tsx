"use client";

import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { formatCount, formatPercent } from "@/lib/admin/format";

import { ChartFrame, type SeriesSpec } from "./chart-frame";

export interface RankedItem {
  key: string;
  label: string;
  value: number;
  /** Optional second line under the label, e.g. the province. */
  note?: string;
}

/**
 * Horizontal ranked bars, for "top doctors".
 *
 * Deliberately not a chart library: with one measure and identity on the axis,
 * an SVG chart buys nothing over a list of divs and costs a legend, a tooltip
 * layer and a resize observer. Length carries magnitude, the label carries
 * identity, the number is printed directly on every row — so there is no
 * hover-only information and nothing is encoded by colour at all.
 */
const SERIES: SeriesSpec[] = [];

export function RankedBars({
  title,
  description,
  items,
  emptyLabel,
  unitLabel = "bookings",
  maxRows = 12,
}: {
  title: string;
  description?: string;
  items: RankedItem[];
  emptyLabel: string;
  unitLabel?: string;
  maxRows?: number;
}) {
  const sorted = React.useMemo(
    () => [...items].sort((a, b) => b.value - a.value),
    [items],
  );
  const shown = sorted.slice(0, maxRows);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  const max = shown.reduce((m, item) => Math.max(m, item.value), 0);

  return (
    <ChartFrame
      title={title}
      {...(description ? { description } : {})}
      series={SERIES}
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">{unitLabel}</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => (
              <TableRow key={item.key}>
                <TableCell>{item.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(item.value)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {total > 0 ? formatPercent(item.value / total) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      {shown.length === 0 || max === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ol className="space-y-2.5">
          {shown.map((item) => (
            <li key={item.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">
                  {item.label}
                  {item.note ? (
                    <span className="ml-2 text-xs text-muted-foreground">{item.note}</span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatCount(item.value)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-chart-1"
                  style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
                  aria-hidden="true"
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      {sorted.length > maxRows ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing the top {maxRows} of {sorted.length}. The table view lists all of them.
        </p>
      ) : null}
    </ChartFrame>
  );
}
