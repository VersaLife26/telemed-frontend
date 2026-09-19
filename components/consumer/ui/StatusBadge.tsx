import { cx } from "@/lib/consumer/cx";
import {
  statusLabel,
  statusTone,
  type BadgeTone as StatusTone,
} from "@/lib/consumer/features/patient-appointment";

import { Badge, type BadgeTone } from "./Badge";

/** The feature module's tone vocabulary, mapped onto the design system's. */
const TONE: Record<StatusTone, BadgeTone> = {
  amber: "warning",
  teal: "success",
  muted: "neutral",
  danger: "danger",
};

export function StatusBadge({ status, className }: { status?: string; className?: string }) {
  const tone = TONE[statusTone(status)];
  return (
    <Badge tone={tone} dot={tone === "success"} className={cx("capitalize", className)}>
      {statusLabel(status)}
    </Badge>
  );
}
