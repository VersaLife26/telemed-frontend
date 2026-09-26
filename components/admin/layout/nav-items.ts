import {
  BadgeCheck,
  CalendarClock,
  FileText,
  LayoutDashboard,
  MessageSquareWarning,
  ScrollText,
  ShieldUser,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { RbacGroup } from "@/lib/admin/rbac";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** The RBAC group guarding this route; see lib/rbac.ts. */
  group: RbacGroup;
}

/**
 * The console's page inventory.
 *
 * Verification sits second rather than buried under a "Doctors" section: it is
 * the screen that decides whether an unlicensed practitioner can take
 * consultations, and it should be one click from anywhere.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    description: "Revenue, bookings and top doctors",
    icon: LayoutDashboard,
    group: "analytics",
  },
  {
    href: "/doctors",
    label: "Verification queue",
    description: "Credential review for doctor applications",
    icon: BadgeCheck,
    group: "credentialing",
  },
  {
    href: "/users",
    label: "Users",
    description: "Search, suspend and reinstate patients and doctors",
    icon: Users,
    group: "users",
  },
  {
    href: "/appointments",
    label: "Appointments",
    description: "All bookings, cancellations and reschedule requests",
    icon: CalendarClock,
    group: "appointments",
  },
  {
    href: "/payments",
    label: "Payments",
    description: "Ledger, commission, payouts, refunds and promo codes",
    icon: Wallet,
    group: "finance",
  },
  {
    href: "/content",
    label: "Content",
    description: "Specialties and formulary",
    icon: FileText,
    group: "content",
  },
  {
    href: "/disputes",
    label: "Disputes",
    description: "Patient complaints and refund mediation",
    icon: MessageSquareWarning,
    group: "disputes",
  },
  {
    href: "/settings/admins",
    label: "Admin accounts",
    description: "Who can sign in to this console, and what each of them can reach",
    icon: ShieldUser,
    group: "adminUsers",
  },
  {
    href: "/audit",
    label: "Audit logs",
    description: "Record of every admin action",
    icon: ScrollText,
    group: "audit",
  },
];
