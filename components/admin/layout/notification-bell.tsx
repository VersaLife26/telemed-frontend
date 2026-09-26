"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { Separator } from "@/components/admin/ui/separator";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { useApiList, useApiMutation, useApiQuery } from "@/lib/admin/api/hooks";
import type { AdminNotification, AdminNotificationUnreadCount } from "@/lib/admin/api/types";
import { formatRelative } from "@/lib/admin/format";
import { cn } from "@/lib/admin/utils";

const UNREAD_COUNT_KEY = ["admin-notifications", "unread-count"] as const;
const LIST_KEY = ["admin-notifications", "list"] as const;
const POLL_MS = 60_000;

/**
 * Header inbox for the API's admin in-app notifications.
 *
 * Unread count is polled so the badge stays fresh without a websocket; the
 * list loads when the popover opens (and on each poll while open).
 */
export function NotificationBell() {
  const [open, setOpen] = React.useState(false);

  const countQuery = useApiQuery<AdminNotificationUnreadCount>(
    UNREAD_COUNT_KEY,
    endpoints.notifications.unreadCount(),
    {
      refetchInterval: POLL_MS,
      refetchOnWindowFocus: true,
    },
  );

  const listQuery = useApiList<AdminNotification>(
    LIST_KEY,
    endpoints.notifications.list(query({ unreadOnly: true, pageSize: 50 })),
    {
      enabled: open,
      refetchInterval: open ? POLL_MS : false,
      refetchOnWindowFocus: open,
    },
  );

  const markRead = useApiMutation<void, { id: string }>({
    method: "POST",
    path: ({ id }) => endpoints.notifications.markRead(id),
    invalidate: [UNREAD_COUNT_KEY, LIST_KEY],
    refreshRoute: false,
  });

  const markAllRead = useApiMutation<void, void>({
    method: "POST",
    path: () => endpoints.notifications.markAllRead(),
    invalidate: [UNREAD_COUNT_KEY, LIST_KEY],
    refreshRoute: false,
    successMessage: () => "All notifications marked read",
  });

  const count = countQuery.data?.count ?? 0;
  const items = listQuery.data?.items ?? [];
  const badgeLabel = count > 99 ? "99+" : String(count);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            count > 0
              ? `Notifications, ${count} unread`
              : "Notifications, none unread"
          }
        >
          <Bell className="size-4" aria-hidden="true" />
          {count > 0 ? (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full",
                "bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground",
              )}
              aria-hidden="true"
            >
              {badgeLabel}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          {count > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          ) : null}
        </div>
        <Separator />

        {listQuery.isLoading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No unread notifications.
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onSelect={() => {
                  markRead.mutate({ id: item.id });
                  setOpen(false);
                }}
              />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The API's `href` names API resources (`/doctor-applications/{id}`), not
 * console pages, so the destination is derived from the kind instead.
 */
function consoleHref(item: AdminNotification): string {
  switch (item.kind) {
    case "doctorApplicationSubmitted":
      return item.resourceId ? `/doctors/${item.resourceId}` : "/doctors";
    case "refundManualRequired":
      return "/payments";
    case "doctorNoShow":
    case "paymentCaptureFailed":
      return "/appointments";
  }
}

function NotificationRow({
  item,
  onSelect,
}: {
  item: AdminNotification;
  onSelect: () => void;
}) {
  return (
    <li>
      <Link
        href={consoleHref(item)}
        onClick={onSelect}
        className="block px-4 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
      >
        <p className="text-sm font-medium leading-snug">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{formatRelative(item.createdAt)}</p>
      </Link>
    </li>
  );
}
