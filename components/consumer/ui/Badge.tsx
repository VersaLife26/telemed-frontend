import type { ReactNode } from "react";

import { cx } from "@/lib/consumer/cx";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger";

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-ink-100 text-ink-600",
  brand: "bg-brand-tint text-brand",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
};

const DOT: Record<BadgeTone, string> = {
  neutral: "bg-ink-600",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  /** A filled dot for live/ongoing states, where the word alone reads static. */
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-label whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className={cx("size-1.5 rounded-full", DOT[tone])} /> : null}
      {children}
    </span>
  );
}
