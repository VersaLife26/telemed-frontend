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
import { useApiQuery } from "@/lib/admin/api/hooks";
import type { PlatformUser, UserActivity } from "@/lib/admin/api/types";
import { formatCount, formatDateTime, humanise } from "@/lib/admin/format";

/**
 * Recent activity for one user: a count of their appointments by status and
 * the audit entries recorded against the account.
 *
 * Fetched on demand rather than with the table: an admin opens this for one
 * user in fifty, and loading it for all fifty would mean fifty queries against
 * the audit log to render a column nobody looked at.
 *
 * Nothing clinical is returned — no symptoms, no diagnosis, no prescription.
 */
export function ActivityDialog({
  user,
  onClose,
}: {
  user: PlatformUser | null;
  onClose: () => void;
}) {
  const enabled = user !== null;
  const queryResult = useApiQuery<UserActivity>(
    ["user-activity", user?.id ?? ""],
    user ? endpoints.users.activity(user.id) : "",
    { enabled },
  );

  return (
    <Dialog open={enabled} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Activity — {user?.fullName || "user"}</DialogTitle>
          <DialogDescription>
            Appointment counts and account events only. Consultation content is not
            readable from this console.
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
              {queryResult.error.traceId ? (
                <p className="font-mono text-xs">Trace ID: {queryResult.error.traceId}</p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
              {(
                [
                  ["Total", queryResult.data.appointments.total],
                  ["Pending payment", queryResult.data.appointments.pendingPayment],
                  ["Confirmed", queryResult.data.appointments.confirmed],
                  ["Completed", queryResult.data.appointments.completed],
                  ["No-show", queryResult.data.appointments.noShow],
                  ["Cancelled", queryResult.data.appointments.cancelled],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-md border border-border p-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-medium tabular-nums">{formatCount(value)}</dd>
                </div>
              ))}
            </dl>
            {queryResult.data.appointments.lastStartAt ? (
              <p className="text-xs text-muted-foreground">
                Most recent appointment {formatDateTime(queryResult.data.appointments.lastStartAt)}
              </p>
            ) : null}

            {queryResult.data.audit.length === 0 ? (
              <EmptyState
                icon={History}
                title="No recorded activity"
                description="Nothing has been logged against this account in the retained window."
              />
            ) : (
              <ol className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {queryResult.data.audit.map((entry) => (
                  <li key={entry.id} className="rounded-md border border-border p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium">{humanise(entry.action)}</p>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {humanise(entry.actorType)}
                      {entry.actorEmail ? ` · ${entry.actorEmail}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
