import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/admin/ui/card";
import { cn } from "@/lib/admin/utils";

/**
 * A single number, given room to be read.
 *
 * Some of what a dashboard needs to say is one number — total revenue, active
 * users, no-show rate. Wrapping those in a chart adds axes and a legend to
 * something that has neither a comparison nor a trajectory. The number is the
 * visualisation.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
  valueClassName,
  hintClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "warning" | "success";
  className?: string;
  valueClassName?: string;
  hintClassName?: string;
}) {
  return (
    <Card
      className={cn(
        "transition-[box-shadow,transform] duration-[160ms] ease-out can-hover:hover:-translate-y-0.5 can-hover:hover:shadow-md",
        className,
      )}
    >
      <CardContent className="flex items-start gap-3 p-5">
        {Icon ? (
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-md",
              tone === "warning"
                ? "bg-warning/15 text-warning"
                : tone === "success"
                  ? "bg-success/15 text-success"
                  : "bg-secondary text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "font-display text-base font-bold tabular-nums tracking-tight whitespace-nowrap sm:text-lg xl:text-xl",
              valueClassName,
            )}
          >
            {value}
          </p>
          {hint ? (
            <p className={cn("text-xs text-muted-foreground whitespace-nowrap", hintClassName)}>{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
