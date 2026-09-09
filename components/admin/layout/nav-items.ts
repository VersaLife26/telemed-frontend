import {
  BadgeCheck,
  CalendarClock,
  FileText,
  LayoutDashboard,
  MessageSquareWarning,
  ScrollText,
  Settings,
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
 * The console's page inventory, in the order the V2 docs §7.3 list them.
 *
 * Verification sits second rather than buried under a "Doctors" section: it is
 * the screen that decides whether an unlicensed practitioner can take
 * consultations, and it should be one click from anywhere.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    description: "Revenue, bookings, utilisation and district coverage",
    icon: LayoutDashboard,
    group: "analytics",
  },
  {
    href: "/doctors",
    label: "Verification queue",
    description: "Credential review for doctors awaiting approval",
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
    description: "All bookings, force-cancel and double-booking resolution",
    icon: CalendarClock,
    group: "appointments",
  },
  {
    href: "/payments",
    label: "Payments",
    description: "Ledger, commission rules, payouts and refunds",
    icon: Wallet,
    group: "finance",
  },
  {
    href: "/content",
    label: "Content",
    description: "Specialties, symptoms, formulary and articles",
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
    href: "/settings",
    label: "Settings",
    description: "Slot defaults, policy, fee caps, flags, corporate clients",
    icon: Settings,
    group: "config",
  },
  {
    // Nested under /settings, but guarded separately: groupForPath takes the
    // longest matching prefix, so /settings/admins resolves to admin_users
    // while /settings resolves to config. This entry is therefore hidden from
    // every role except super_admin, while Settings above stays visible to ops
    // and finance.
    href: "/settings/admins",
    label: "Admin accounts",
    description: "Who can sign in to this console, and what each of them can reach",
    icon: ShieldUser,
    group: "admin_users",
  },
  {
    href: "/audit",
    label: "Audit logs",
    description: "Immutable, hash-chained record of every admin action",
    icon: ScrollText,
    group: "audit",
  },
];
