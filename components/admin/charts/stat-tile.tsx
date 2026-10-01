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
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "warning" | "success";
  className?: string;
}) {
  return (
    <Card className={cn("h-full min-w-0 overflow-hidden", className)}>
      <CardContent className="flex h-full items-start gap-3 p-4 pt-4 sm:p-5 sm:pt-5">
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
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className="mt-1 font-display text-xl font-bold leading-tight tracking-tight tabular-nums break-words"
            title={value}
          >
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs leading-snug text-muted-foreground" title={hint}>
              {hint}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
