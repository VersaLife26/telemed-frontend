"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
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
import type { RevenuePoint } from "@/lib/admin/api/types";
import { formatDate, formatMoney, formatShortDay } from "@/lib/admin/format";

import { CHART_COLORS, ChartFrame, type SeriesSpec } from "./chart-frame";
import { ChartTooltipBody } from "./chart-tooltip";

/**
 * Captured revenue and platform commission over time.
 *
 * Two series on **one** axis. Commission is a component of gross, measured in
 * the same unit, so a second y-scale would be both unnecessary and misleading —
 * it would let the two lines cross at a point that means nothing.
 */
const SERIES: SeriesSpec[] = [
  { key: "gross", label: "Captured", color: CHART_COLORS.slot1 },
  { key: "commission", label: "Platform commission", color: CHART_COLORS.slot2 },
];

interface Row {
  day: string;
  gross: number;
  commission: number;
}

export function RevenueChart({
  points,
  currency,
}: {
  points: RevenuePoint[];
  currency: string;
}) {
  const rows = React.useMemo<Row[]>(
    () =>
      [...points]
        .sort((a, b) => a.period.localeCompare(b.period))
        .map((point) => ({
          day: point.period,
          gross: point.capturedCents,
          commission: point.commissionCents,
        })),
    [points],
  );

  return (
    <ChartFrame
      title="Revenue"
      description={`Captured payments and platform commission per day, in ${currency}.`}
      series={SERIES}
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead className="text-right">Captured</TableHead>
              <TableHead className="text-right">Commission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.day}>
                <TableCell>{formatDate(row.day)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(row.gross, currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(row.commission, currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeDasharray="3 3"
            vertical={false}
          />
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
            width={72}
            tickFormatter={(value: number) => formatMoney(value, currency, { compact: true })}
          />
          <Tooltip
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <ChartTooltipBody
                  label={formatDate(String(label))}
                  rows={SERIES.map((s) => ({
                    key: s.key,
                    label: s.label,
                    color: s.color,
                    value: formatMoney(
                      Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0),
                      currency,
                    ),
                  }))}
                />
              );
            }}
          />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
