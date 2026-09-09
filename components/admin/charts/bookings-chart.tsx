"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import type { BookingsPoint } from "@/lib/admin/api/types";
import { formatCount, formatDate, formatShortDay } from "@/lib/admin/format";

import { ChartFrame, type SeriesSpec } from "./chart-frame";
import { ChartTooltipBody } from "./chart-tooltip";

/**
 * Bookings per day, split by outcome.
 *
 * The segments are *states*, not identities, so they wear the reserved status
 * colours rather than categorical slots: completed is good, no-show is
 * serious, cancelled is neutral. That is also why the legend labels are words
 * and the table view exists — status must never be carried by colour alone.
 *
 * Segments are stacked with a 2px surface gap so adjacent fills stay separable
 * for a reader who cannot distinguish the hues.
 */
const SERIES: SeriesSpec[] = [
  { key: "completed", label: "Completed", color: "var(--success)" },
  { key: "confirmed", label: "Confirmed / upcoming", color: "var(--chart-1)" },
  { key: "cancelled", label: "Cancelled", color: "var(--muted-foreground)" },
  { key: "no_show", label: "No-show", color: "var(--warning)" },
];

interface Row {
  day: string;
  completed: number;
  confirmed: number;
  cancelled: number;
  no_show: number;
}

export function BookingsChart({ points }: { points: BookingsPoint[] }) {
  const rows = React.useMemo<Row[]>(() => {
    const byDay = new Map<string, Row>();
    for (const point of points) {
      const existing =
        byDay.get(point.day) ??
        { day: point.day, completed: 0, confirmed: 0, cancelled: 0, no_show: 0 };
      switch (point.status) {
        case "completed":
          existing.completed += point.booking_count;
          break;
        case "no_show":
          existing.no_show += point.booking_count;
          break;
        case "cancelled":
          existing.cancelled += point.booking_count;
          break;
        case "created":
        case "confirmed":
          existing.confirmed += point.booking_count;
          break;
      }
      byDay.set(point.day, existing);
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [points]);

  return (
    <ChartFrame
      title="Bookings per day"
      description="Every appointment created in the period, by how it ended."
      series={SERIES}
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              {SERIES.map((s) => (
                <TableHead key={s.key} className="text-right">
                  {s.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.day}>
                <TableCell>{formatDate(row.day)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(row.completed)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(row.confirmed)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(row.cancelled)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(row.no_show)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={formatShortDay}
            stroke="var(--chart-axis)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            minTickGap={24}
          />
          <YAxis
            stroke="var(--chart-axis)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={48}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <ChartTooltipBody
                  label={formatDate(String(label))}
                  rows={SERIES.map((s) => ({
                    key: s.key,
                    label: s.label,
                    color: s.color,
                    value: formatCount(
                      Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0),
                    ),
                  }))}
                />
              );
            }}
          />
          {SERIES.map((s, index) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="bookings"
              fill={s.color}
              // A 2px gap in the surface colour between stacked segments keeps
              // them separable without relying on the hue difference.
              stroke="var(--card)"
              strokeWidth={2}
              radius={index === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
