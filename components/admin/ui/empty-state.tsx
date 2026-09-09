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
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <Icon className="size-8 text-muted-foreground" aria-hidden={true} />
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <div className="mx-auto max-w-md text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {action}
    </div>
  );
}
