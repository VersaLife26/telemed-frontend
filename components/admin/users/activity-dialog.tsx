"use client";

import { History } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiList } from "@/lib/admin/api/hooks";
import type { AdminUserRecord, UserActivityEntry } from "@/lib/admin/api/types";
import { formatDateTime, humanise } from "@/lib/admin/format";

/**
 * Recent activity for one user.
 *
 * Fetched on demand rather than with the table: an admin opens this for one
 * user in fifty, and loading it for all fifty would mean fifty queries against
 * the audit log to render a column nobody looked at.
 *
 * The list carries no clinical content — no symptoms, no diagnosis, no
 * prescription. That is not a UI choice: the console's database role has no
 * SELECT grant on those tables, so the backend could not send them if this
 * screen asked.
 */
export function ActivityDialog({
  user,
  onClose,
}: {
  user: AdminUserRecord | null;
  onClose: () => void;
}) {
  const enabled = user !== null;
  const queryResult = useApiList<UserActivityEntry>(
    ["user-activity", user?.user_id ?? ""],
    user ? endpoints.users.activity(user.user_id) : "",
    { enabled },
  );

  return (
    <Dialog open={enabled} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Activity — {user?.full_name ?? "user"}</DialogTitle>
          <DialogDescription>
            Account and booking events only. Consultation content is not readable from
            this console.
          </DialogDescription>
        </DialogHeader>

        {queryResult.isPending ? (
          <div className="space-y-2" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading activity</span>
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : queryResult.isError ? (
          <Alert variant="destructive">
            <History aria-hidden="true" />
            <AlertTitle>Could not load activity</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>{queryResult.error.userMessage}</p>
              {queryResult.error.requestId ? (
                <p className="font-mono text-xs">
                  Request ID: {queryResult.error.requestId}
                </p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : queryResult.data.data.length === 0 ? (
          <EmptyState
            icon={History}
            title="No recorded activity"
            description="Nothing has been logged against this account in the retained window."
          />
        ) : (
          <ol className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {queryResult.data.data.map((entry, index) => (
              <li
                key={`${entry.occurred_at}-${index}`}
                className="rounded-md border border-border p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{humanise(entry.kind)}</p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(entry.occurred_at)}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{entry.summary}</p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
