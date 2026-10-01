"use client";

import { endpoints, query } from "@/lib/admin/api/endpoints";
import { useApiList } from "@/lib/admin/api/hooks";
import type { AdminNotification } from "@/lib/admin/api/types";

export const ADMIN_UNREAD_INBOX_QUERY_KEY = ["admin-notifications", "unread-inbox"] as const;

export const ADMIN_UNREAD_INBOX_POLL_MS = 60_000;

/** Shared unread inbox poll for the bell, sidebar badges, and queue banners. */
export function useUnreadAdminInbox() {
  return useApiList<AdminNotification>(
    ADMIN_UNREAD_INBOX_QUERY_KEY,
    endpoints.notifications.list(query({ unreadOnly: true, pageSize: 100 })),
    {
      refetchInterval: ADMIN_UNREAD_INBOX_POLL_MS,
      refetchOnWindowFocus: true,
    },
  );
}
