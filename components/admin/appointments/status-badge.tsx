import { Badge } from "@/components/admin/ui/badge";
import type { AppointmentStatus } from "@/lib/admin/api/types";

const LABELS: Record<AppointmentStatus, string> = {
  pendingPayment: "Pending payment",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  noShow: "No-show",
};

const VARIANTS: Record<
  AppointmentStatus,
  "default" | "success" | "warning" | "destructive" | "muted" | "info"
> = {
  pendingPayment: "muted",
  confirmed: "info",
  cancelled: "destructive",
  completed: "success",
  noShow: "warning",
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
