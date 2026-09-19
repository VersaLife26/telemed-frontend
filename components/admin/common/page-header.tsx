import * as React from "react";

/**
 * One h1 per page, always, and never two. Screen-reader users navigate by
 * heading level before they navigate by anything else.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <div className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
