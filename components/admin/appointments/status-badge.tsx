import { Badge } from "@/components/admin/ui/badge";
import type { AppointmentStatus } from "@/lib/admin/api/types";

const LABELS: Record<AppointmentStatus, string> = {
  created: "Created",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
};

const VARIANTS: Record<
  AppointmentStatus,
  "default" | "success" | "warning" | "destructive" | "muted" | "info"
> = {
  created: "muted",
  confirmed: "info",
  cancelled: "destructive",
  completed: "success",
  no_show: "warning",
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
