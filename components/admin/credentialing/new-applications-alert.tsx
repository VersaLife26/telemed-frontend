"use client";

import { Inbox } from "lucide-react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Button } from "@/components/admin/ui/button";
import { endpoints, query } from "@/lib/admin/api/endpoints";
import { useApiList } from "@/lib/admin/api/hooks";
import type { AdminNotification } from "@/lib/admin/api/types";

/**
 * Banner on the verification queue when the admin inbox has unread
 * doctor-application notifications. The inbox carries other kinds too, so the
 * unread page is filtered here rather than trusting the global unread count.
 * Refresh re-runs the server render so new rows appear without a full
 * navigation.
 */
export function NewApplicationsAlert() {
  const router = useRouter();
  const { data } = useApiList<AdminNotification>(
    ["admin-notifications", "unread"],
    endpoints.notifications.list(query({ unreadOnly: true, pageSize: 100 })),
    {
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    },
  );

  const count = data?.items.filter((n) => n.kind === "doctorApplicationSubmitted").length ?? 0;
  if (count < 1) return null;

  return (
    <Alert variant="info" className="mb-4">
      <Inbox aria-hidden="true" />
      <AlertTitle>New applications waiting for review</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>
          {count === 1
            ? "There is 1 unread application notification."
            : `There are ${count} unread application notifications.`}
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
