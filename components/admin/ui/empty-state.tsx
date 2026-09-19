import * as React from "react";

import { cn } from "@/lib/admin/utils";

/**
 * The empty state every list screen uses.
 *
 * Empty states say which of the three cases this is — nothing exists yet, the
 * filter excluded everything, or the backend refused — because "No results"
 * for all three is the fastest way to make an admin think the data is gone
 * when it is only filtered.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/60 px-6 py-14 text-center shadow-sm",
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-12 items-center justify-center rounded-md bg-secondary text-primary">
          <Icon className="size-6" aria-hidden={true} />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-display text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <div className="mx-auto max-w-md text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {action}
    </div>
  );
}
