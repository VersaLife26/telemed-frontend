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
import { cn } from "@/lib/admin/utils";

export interface SeriesSpec {
  key: string;
  label: string;
  /** A `var(--chart-N)` token. Slots are assigned in order and never cycled. */
  color: string;
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
}: {
  title: string;
  description?: string;
  series: readonly SeriesSpec[];
  children: React.ReactNode;
  /** Rendered when the reader switches to the table view. */
  table: React.ReactNode;
  className?: string;
}) {
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle id={titleId}>{title}</CardTitle>
          {description ? (
            <CardDescription id={descriptionId}>{description}</CardDescription>
          ) : null}
        </div>
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
            {children}
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
