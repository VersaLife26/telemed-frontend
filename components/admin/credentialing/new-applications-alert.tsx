"use client";

import { Inbox } from "lucide-react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Button } from "@/components/admin/ui/button";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiQuery } from "@/lib/admin/api/hooks";
import type { AdminNotificationUnreadCount } from "@/lib/admin/api/types";

/**
 * Banner on the verification queue when the admin inbox has unread
 * doctor-application notifications. Refresh re-runs the server render so new
 * rows appear without a full navigation.
 */
export function NewApplicationsAlert() {
  const router = useRouter();
  const { data } = useApiQuery<AdminNotificationUnreadCount>(
    ["admin-notifications", "unread-count"],
    endpoints.notifications.unreadCount(),
    {
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    },
  );

  if (!data || data.count < 1) return null;

  return (
    <Alert variant="info" className="mb-4">
      <Inbox aria-hidden="true" />
      <AlertTitle>New applications waiting for review</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>
          {data.count === 1
            ? "There is 1 unread application notification."
            : `There are ${data.count} unread application notifications.`}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.refresh()}
        >
          Refresh the queue
        </Button>
      </AlertDescription>
    </Alert>
  );
}
