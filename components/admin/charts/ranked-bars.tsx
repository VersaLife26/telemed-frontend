"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { formatCount, formatPercent } from "@/lib/admin/format";

import { CHART_COLORS, ChartFrame, RANKED_VISUALIZATIONS, type SeriesSpec } from "./chart-frame";
import { ChartTooltipBody } from "./chart-tooltip";

export interface RankedItem {
  key: string;
  label: string;
  value: number;
  /** Optional second line under the label, e.g. the province. */
  note?: string;
}

const SERIES: SeriesSpec[] = [];
const CHART_HEIGHT = 280;
const PIE_PALETTE = [
  CHART_COLORS.slot1,
  CHART_COLORS.slot2,
  CHART_COLORS.slot3,
  CHART_COLORS.slot4,
] as const;

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

  const pieData = React.useMemo(
    () =>
      shown.map((item, index) => ({
        key: item.key,
        name: item.label,
        value: item.value,
        fill: PIE_PALETTE[index % PIE_PALETTE.length],
      })),
    [shown],
  );

  function renderVisualization(id: string) {
    if (shown.length === 0 || max === 0) {
      return <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
    }

    switch (id) {
      case "verticalBar":
        return (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={shown} margin={{ top: 8, right: 12, bottom: 48, left: 4 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--chart-axis)"
                tickLine={false}
                axisLine={false}
                fontSize={10}
                interval={0}
                angle={-24}
                textAnchor="end"
                height={56}
              />
              <YAxis stroke="var(--chart-axis)" tickLine={false} axisLine={false} fontSize={11} width={40} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const row = payload[0].payload as RankedItem;
                  return (
                    <ChartTooltipBody
                      label={row.label}
                      rows={[
                        {
                          key: "value",
                          label: unitLabel,
                          color: CHART_COLORS.slot1,
                          value: formatCount(row.value),
                        },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="value" fill={CHART_COLORS.slot1} radius={[4, 4, 0, 0]} isAnimationActive={false} />
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
                  const row = payload[0].payload as (typeof pieData)[number];
                  return (
                    <ChartTooltipBody
                      label={row.name}
                      rows={[
                        {
                          key: row.key,
                          label: unitLabel ?? "bookings",
                          color: row.fill ?? CHART_COLORS.slot1,
                          value: `${formatCount(row.value)} (${total > 0 ? formatPercent(row.value / total) : "—"})`,
                        },
                      ]}
                    />
                  );
                }}
              />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={96}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {pieData.map((slice) => (
                  <Cell key={slice.key} fill={slice.fill} stroke="var(--card)" strokeWidth={2} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      case "horizontalBar":
      default:
        return (
          <>
            <ol className="space-y-2.5">
              {shown.map((item) => (
                <li key={item.key} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
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
            {sorted.length > maxRows ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing the top {maxRows} of {sorted.length}. The table view lists all of them.
              </p>
            ) : null}
          </>
        );
    }
  }

  return (
    <ChartFrame
      title={title}
      {...(description ? { description } : {})}
      series={SERIES}
      visualizations={RANKED_VISUALIZATIONS}
      defaultVisualization="horizontalBar"
      renderVisualization={renderVisualization}
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
    />
  );
}
