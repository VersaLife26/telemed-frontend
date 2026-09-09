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
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "warning" | "success";
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        {Icon ? (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              tone === "warning"
                ? "bg-warning/15 text-warning"
                : tone === "success"
                  ? "bg-success/15 text-success"
                  : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-2xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
