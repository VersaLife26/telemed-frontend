"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
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
import type { RevenuePoint } from "@/lib/admin/api/types";
import { formatDate, formatMoney, formatShortDay } from "@/lib/admin/format";

import {
  CHART_COLORS,
  ChartFrame,
  REVENUE_VISUALIZATIONS,
  type SeriesSpec,
} from "./chart-frame";
import {
  ChartTooltipBody,
  firstPayloadValue,
  numericPayloadValue,
  type RechartsTooltipPayload,
} from "./chart-tooltip";

const SERIES: SeriesSpec[] = [
  { key: "gross", label: "Captured", color: CHART_COLORS.slot1 },
  { key: "commission", label: "Platform commission", color: CHART_COLORS.slot2 },
];

const GROSS_SERIES = SERIES[0]!;
const COMMISSION_SERIES = SERIES[1]!;

interface Row {
  day: string;
  gross: number;
  commission: number;
}

const CHART_HEIGHT = 280;
const MARGIN = { top: 8, right: 12, bottom: 4, left: 4 };

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

  const pieTotals = React.useMemo(
    () => [
      {
        key: "gross",
        name: GROSS_SERIES.label,
        value: rows.reduce((s, r) => s + r.gross, 0),
        fill: GROSS_SERIES.color,
      },
      {
        key: "commission",
        name: COMMISSION_SERIES.label,
        value: rows.reduce((s, r) => s + r.commission, 0),
        fill: COMMISSION_SERIES.color,
      },
    ],
    [rows],
  );

  const tooltipRows = (payload: RechartsTooltipPayload | undefined, label: string) => (
    <ChartTooltipBody
      label={formatDate(label)}
      rows={SERIES.map((s) => ({
        key: s.key,
        label: s.label,
        color: s.color,
        value: formatMoney(numericPayloadValue(payload, s.key), currency),
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
    <YAxis
      stroke="var(--chart-axis)"
      tickLine={false}
      axisLine={false}
      fontSize={11}
      width={72}
      tickFormatter={(value: number) => formatMoney(value, currency, { compact: true })}
    />
  );

  const grid = (
    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
  );

  function renderVisualization(id: string) {
    switch (id) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={rows} margin={MARGIN}>
              {grid}
              {axisX}
              {axisY}
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? tooltipRows(payload as RechartsTooltipPayload, String(label)) : null
                }
              />
              {SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <AreaChart data={rows} margin={MARGIN}>
              {grid}
              {axisX}
              {axisY}
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? tooltipRows(payload as RechartsTooltipPayload, String(label)) : null
                }
              />
              {SERIES.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.2}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
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
                          key: "gross",
                          label: "Captured",
                          color: GROSS_SERIES.color,
                          value: formatMoney(firstPayloadValue(payload as RechartsTooltipPayload), currency),
                        },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="gross" name="Captured" fill={GROSS_SERIES.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "pie":
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
                          color: row.fill ?? GROSS_SERIES.color,
                          value: formatMoney(row.value, currency),
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
      case "line":
      default:
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={rows} margin={MARGIN}>
              {grid}
              {axisX}
              {axisY}
              <Tooltip
                cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? tooltipRows(payload as RechartsTooltipPayload, String(label)) : null
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
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
    }
  }

  return (
    <ChartFrame
      title="Revenue"
      description={`Captured payments and platform commission per day, in ${currency}.`}
      series={SERIES}
      visualizations={REVENUE_VISUALIZATIONS}
      defaultVisualization="line"
      renderVisualization={renderVisualization}
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
    />
  );
}
