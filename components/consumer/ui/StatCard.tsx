import type { ReactNode } from "react";

import { cx } from "@/lib/consumer/cx";

export function StatCard({
  value,
  label,
  trend,
  icon,
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  /** Secondary line — a delta, a period, a qualifier. */
  trend?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-3.5 rounded-lg border border-border-subtle bg-surface p-5 shadow-sm",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint text-brand"
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-h4 text-ink tabular-time">{value}</p>
        <p className="mt-0.5 text-body-sm text-faint">{label}</p>
        {trend ? <p className="mt-0.5 text-body-sm text-success">{trend}</p> : null}
      </div>
    </div>
  );
}
