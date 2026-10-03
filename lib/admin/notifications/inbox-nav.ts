import type { AdminNotification } from "@/lib/admin/api/types";

/** Console routes that show unread inbox counts in the sidebar. */
export const NAV_INBOX_BADGE_HREFS = new Set([
  "/doctors",
  "/users",
  "/appointments",
  "/payments",
  "/disputes",
]);

/**
 * Maps an admin inbox row to the primary nav item that should surface its
 * unread count. Mirrors where notification rows link in the header bell.
 */
export function navHrefForNotification(
  item: Pick<AdminNotification, "kind" | "resourceId">,
): string | null {
  switch (item.kind) {
    case "doctorApplicationSubmitted":
      return "/doctors";
    case "refundManualRequired":
      return "/payments";
    case "doctorNoShow":
    case "paymentCaptureFailed":
      return "/appointments";
    case "customerCare":
      return "/disputes";
    default:
      return null;
  }
}

export function unreadCountByNavHref(
  items: readonly AdminNotification[],
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const href = navHrefForNotification(item);
    if (!href) continue;
    counts[href] = (counts[href] ?? 0) + 1;
  }
  return counts;
}

export function formatNavInboxHint(count: number): string {
  return count === 1 ? "1 new notification" : `${count} new notifications`;
}

export function formatNavBadgeLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
}
