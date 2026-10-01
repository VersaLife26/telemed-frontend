"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { NAV_ITEMS } from "./nav-items";
import {
  NAV_INBOX_BADGE_HREFS,
  formatNavBadgeLabel,
  formatNavInboxHint,
  unreadCountByNavHref,
} from "@/lib/admin/notifications/inbox-nav";
import { useUnreadAdminInbox } from "@/lib/admin/notifications/use-unread-inbox";
import { type RbacGroup, can } from "@/lib/admin/rbac";
import type { AdminRole } from "@/lib/admin/api/types";
import { cn } from "@/lib/admin/utils";

/**
 * Primary navigation.
 *
 * Items the caller's role cannot use are not rendered — the same matrix the
 * gateway enforces, mirrored in `lib/rbac.ts`. Hiding them is a courtesy, not
 * a control: the backend would refuse the request regardless.
 */
export function SidebarNav({
  roles,
  onNavigate,
}: {
  roles: readonly AdminRole[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visible = NAV_ITEMS.filter((item) => can(roles, item.group as RbacGroup));
  const { data: inbox } = useUnreadAdminInbox();
  const unreadByHref = useMemo(
    () => unreadCountByNavHref(inbox?.items ?? []),
    [inbox?.items],
  );

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1 p-3">
      {visible.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const showInboxBadge = NAV_INBOX_BADGE_HREFS.has(item.href);
        const unread = showInboxBadge ? (unreadByHref[item.href] ?? 0) : 0;
        const inboxHint = unread > 0 ? formatNavInboxHint(unread) : null;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            {...(unread > 0
              ? { "aria-label": `${item.label}, ${formatNavInboxHint(unread)}` }
              : {})}
            className={cn(
              "group flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-[background-color,color,box-shadow] duration-[160ms] ease-out",
              active
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-sm ring-1 ring-blue-200/80"
                : "text-sidebar-foreground can-hover:hover:bg-sidebar-accent/70",
            )}
          >
            <item.icon
              className={cn(
                "mt-0.5 size-4 shrink-0 transition-opacity",
                active ? "text-primary" : "opacity-70",
              )}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 flex flex-col">
              <span className="flex items-center justify-between gap-2">
                <span>{item.label}</span>
                {unread > 0 ? (
                  <span
                    className={cn(
                      "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5",
                      "bg-destructive text-[10px] font-semibold leading-none text-destructive-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {formatNavBadgeLabel(unread)}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "text-xs font-normal",
                  inboxHint
                    ? "font-medium text-destructive"
                    : active
                      ? "text-sidebar-accent-foreground/75"
                      : "text-muted-foreground",
                )}
              >
                {inboxHint ?? item.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
