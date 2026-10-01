"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
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
import type { BookingsDay } from "@/lib/admin/api/types";
import { formatCount, formatDate, formatPercent, formatShortDay } from "@/lib/admin/format";

import { BOOKINGS_VISUALIZATIONS, ChartFrame, type SeriesSpec } from "./chart-frame";
import { ChartTooltipBody } from "./chart-tooltip";

const SERIES: SeriesSpec[] = [
  { key: "completed", label: "Completed", color: "var(--success)" },
  { key: "confirmed", label: "Confirmed / upcoming", color: "var(--chart-1)" },
  { key: "cancelled", label: "Cancelled", color: "var(--muted-foreground)" },
  { key: "noShow", label: "No-show", color: "var(--warning)" },
];

type Row = Pick<BookingsDay, "completed" | "confirmed" | "cancelled" | "noShow"> & {
  day: string;
  total: number;
};

const CHART_HEIGHT = 280;
const MARGIN = { top: 8, right: 12, bottom: 4, left: 4 };

export function BookingsChart({ points }: { points: BookingsDay[] }) {
  const rows = React.useMemo<Row[]>(
    () =>
      [...points]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((point) => ({
          day: point.date,
          completed: point.completed,
          confirmed: point.confirmed,
          cancelled: point.cancelled,
          noShow: point.noShow,
          total: point.completed + point.confirmed + point.cancelled + point.noShow,
        })),
    [points],
  );

  const pieTotals = React.useMemo(
    () =>
      SERIES.map((s) => ({
        key: s.key,
        name: s.label,
        value: rows.reduce((sum, row) => sum + Number(row[s.key as keyof Row] ?? 0), 0),
        fill: s.color,
      })),
    [rows],
  );

  const tooltipRows = (payload: readonly { dataKey?: string; value?: number }[], label: string) => (
    <ChartTooltipBody
      label={formatDate(label)}
      rows={SERIES.map((s) => ({
        key: s.key,
        label: s.label,
        color: s.color,
        value: formatCount(Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0)),
      }))}
    />
  );

  const axisX = (
    <XAxis
      dataKey="day"
      tickFormatter={formatShortDay}
      stroke="var(--chart-axis)"
      tickLine={false}
      axisLine={false}
      fontSize={11}
      minTickGap={24}
    />
  );

  const axisY = (
    <YAxis stroke="var(--chart-axis)" tickLine={false} axisLine={false} fontSize={11} width={48} allowDecimals={false} />
  );

  const grid = (
    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
  );

  function renderBars(stacked: boolean) {
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={rows} margin={MARGIN}>
          {grid}
          {axisX}
          {axisY}
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? tooltipRows(payload, String(label)) : null
            }
          />
          {SERIES.map((s, index) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? "bookings" : undefined}
              fill={s.color}
              stroke="var(--card)"
              strokeWidth={stacked ? 2 : 0}
              radius={stacked && index === SERIES.length - 1 ? [4, 4, 0, 0] : stacked ? 0 : [4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  function renderVisualization(id: string) {
    switch (id) {
      case "groupedBar":
        return renderBars(false);
      case "line":
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={rows} margin={MARGIN}>
              {grid}
              {axisX}
              {axisY}
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? tooltipRows(payload, String(label)) : null
                }
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
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      case "histogram":
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={rows} margin={MARGIN} barCategoryGap="20%">
              {grid}
              {axisX}
              {axisY}
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null;
                  return (
                    <ChartTooltipBody
                      label={formatDate(String(label))}
                      rows={[
                        {
                          key: "total",
                          label: "Total bookings",
                          color: "var(--chart-1)",
                          value: formatCount(Number(payload[0].value)),
                        },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="total" name="Total bookings" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "pie": {
        const total = pieTotals.reduce((s, p) => s + p.value, 0);
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <PieChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const row = payload[0].payload as (typeof pieTotals)[number];
                  return (
                    <ChartTooltipBody
                      label="Period total"
                      rows={[
                        {
                          key: row.key,
                          label: row.name,
                          color: row.fill,
                          value: `${formatCount(row.value)} (${total > 0 ? formatPercent(row.value / total) : "—"})`,
                        },
                      ]}
                    />
                  );
                }}
              />
              <Pie
                data={pieTotals}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={96}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {pieTotals.map((slice) => (
                  <Cell key={slice.key} fill={slice.fill} stroke="var(--card)" strokeWidth={2} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      }
      case "stackedBar":
      default:
        return renderBars(true);
    }
  }

  return (
    <ChartFrame
      title="Bookings per day"
      description="Every appointment created in the period, by how it ended."
      series={SERIES}
      visualizations={BOOKINGS_VISUALIZATIONS}
      defaultVisualization="stackedBar"
      renderVisualization={renderVisualization}
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
                <TableCell className="text-right tabular-nums">{formatCount(row.noShow)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}
