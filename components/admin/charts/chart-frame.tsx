"use client";

import * as React from "react";
import { BarChart3, Table2 } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { cn } from "@/lib/admin/utils";

export interface SeriesSpec {
  key: string;
  label: string;
  /** A `var(--chart-N)` token. Slots are assigned in order and never cycled. */
  color: string;
}

export interface ChartVisualizationOption {
  id: string;
  label: string;
}

/**
 * The frame every chart in the console sits in.
 *
 * It supplies three things the charts themselves should not each reinvent:
 *
 *  - a **legend** whenever there are two or more series, so identity is never
 *    carried by colour alone;
 *  - a **table view**, one button away. This is the accessible equivalent of
 *    the chart and it is also the relief the palette validator requires for
 *    the one colour that lands just under 3:1 against the light surface;
 *  - optional **chart type** picker (line, bar, pie, …) when a dataset supports
 *    more than one visual encoding;
 *  - a labelled `figure`/`figcaption` pair, so the chart announces as one
 *    thing rather than as a pile of unlabelled SVG.
 */
export function ChartFrame({
  title,
  description,
  series,
  children,
  table,
  className,
  visualizations,
  defaultVisualization,
  renderVisualization,
}: {
  title: string;
  description?: string;
  series: readonly SeriesSpec[];
  children?: React.ReactNode;
  table: React.ReactNode;
  className?: string;
  visualizations?: readonly ChartVisualizationOption[];
  defaultVisualization?: string;
  /** When set, `children` is ignored and the picker drives what is rendered. */
  renderVisualization?: (visualizationId: string) => React.ReactNode;
}) {
  const options = visualizations ?? [];
  const initialViz = defaultVisualization ?? options[0]?.id ?? "default";
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const [visualization, setVisualization] = React.useState(initialViz);
  const titleId = React.useId();
  const descriptionId = React.useId();

  const chartBody =
    renderVisualization && options.length > 0
      ? renderVisualization(visualization)
      : children;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle id={titleId}>{title}</CardTitle>
          {description ? (
            <CardDescription id={descriptionId}>{description}</CardDescription>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {view === "chart" && options.length > 1 ? (
            <Select value={visualization} onValueChange={setVisualization}>
              <SelectTrigger className="h-8 w-[10.5rem]" aria-label={`${title} chart type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
            aria-pressed={view === "table"}
          >
            {view === "chart" ? (
              <>
                <Table2 className="size-4" aria-hidden="true" />
                Table
              </>
            ) : (
              <>
                <BarChart3 className="size-4" aria-hidden="true" />
                Chart
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {series.length > 1 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label={`${title} series`}>
            {series.map((item) => (
              <li key={item.key} className="flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-[3px]"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground">{item.label}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {view === "chart" ? (
          <figure
            role="group"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
          >
            {chartBody}
            <figcaption className="sr-only">
              {title}. {description ?? ""} An equivalent data table is available from
              the Table button.
            </figcaption>
          </figure>
        ) : (
          <div className="max-h-96 overflow-auto">{table}</div>
        )}
      </CardContent>
    </Card>
  );
}

/** The four categorical slots, in fixed assignment order. */
export const CHART_COLORS = {
  slot1: "var(--chart-1)",
  slot2: "var(--chart-2)",
  slot3: "var(--chart-3)",
  slot4: "var(--chart-4)",
} as const;

export const REVENUE_VISUALIZATIONS: ChartVisualizationOption[] = [
  { id: "line", label: "Line chart" },
  { id: "bar", label: "Bar chart" },
  { id: "area", label: "Area chart" },
  { id: "histogram", label: "Histogram" },
  { id: "pie", label: "Pie chart" },
];

export const BOOKINGS_VISUALIZATIONS: ChartVisualizationOption[] = [
  { id: "stackedBar", label: "Stacked bar" },
  { id: "groupedBar", label: "Grouped bar" },
  { id: "line", label: "Line chart" },
  { id: "histogram", label: "Histogram" },
  { id: "pie", label: "Pie chart" },
];

export const RANKED_VISUALIZATIONS: ChartVisualizationOption[] = [
  { id: "horizontalBar", label: "Horizontal bars" },
  { id: "verticalBar", label: "Vertical bar" },
  { id: "pie", label: "Pie chart" },
];
