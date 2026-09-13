import { cx } from "@/lib/consumer/cx";
import { statusLabel, statusTone, type BadgeTone } from "@/lib/consumer/features/patient-appointment";

const TONE: Record<BadgeTone, string> = {
  amber: "bg-stamp-soft text-stamp",
  teal: "bg-ward-soft text-ward",
  muted: "bg-linen text-text-label",
  danger: "bg-[#fde8e6] text-danger",
};

export function StatusBadge({ status }: { status?: string }) {
  const tone = statusTone(status);
  return (
    <span
      className={cx(
        "inline-flex min-h-8 items-center rounded-full px-3 py-1 text-caption font-medium capitalize",
        TONE[tone],
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
