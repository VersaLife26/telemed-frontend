import type { ReactNode } from "react";
import { cx } from "@/lib/consumer/cx";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-card)] border border-border bg-paper p-6 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
