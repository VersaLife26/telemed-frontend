import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cx } from "@/lib/consumer/cx";

type Tone = "info" | "success" | "warning" | "danger";

const TONE: Record<Tone, { wrap: string; puck: string; Icon: typeof Info }> = {
  info: { wrap: "bg-brand-tint", puck: "bg-brand", Icon: Info },
  success: { wrap: "bg-success-tint", puck: "bg-success", Icon: CheckCircle2 },
  warning: { wrap: "bg-warning-tint", puck: "bg-warning", Icon: AlertTriangle },
  danger: { wrap: "bg-danger-tint", puck: "bg-danger", Icon: XCircle },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { wrap, puck, Icon } = TONE[tone];
  return (
    <div
      // Only danger interrupts; the rest are status the user can read in order.
      role={tone === "danger" ? "alert" : "status"}
      className={cx("flex gap-3 rounded-md p-4", wrap, className)}
    >
      <span
        aria-hidden="true"
        className={cx("flex size-6 shrink-0 items-center justify-center rounded-full text-white", puck)}
      >
        <Icon className="size-3.5" strokeWidth={2.5} />
      </span>
      <div className="min-w-0">
        {title ? <p className="text-label text-ink">{title}</p> : null}
        {children ? <div className="text-body-sm text-muted">{children}</div> : null}
      </div>
    </div>
  );
}
