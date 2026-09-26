import { AlertTriangle, PlugZap, ShieldOff, WifiOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import type { ApiError } from "@/lib/admin/api/errors";

/**
 * How a failed fetch looks on a page.
 *
 * Three things are always present: what happened in the admin's own terms,
 * what to do about it, and the trace id. The trace id is what turns
 * "payments is broken" into a ticket someone can actually trace through the
 * API's logs.
 *
 * A 404 gets its own wording, because "this endpoint is not deployed" is very
 * different information from "this record was deleted".
 */
export function ErrorState({
  error,
  what,
  /** When true, 404 means the record/key has never been set rather than the route missing. */
  missingRecord,
}: {
  error: ApiError;
  /** What was being loaded, e.g. "the payment ledger". */
  what: string;
  missingRecord?: boolean;
}) {
  const notFound = error.status === 404;
  const notDeployed = notFound && !missingRecord;
  const Icon =
    error.code === "ip_not_allowed"
      ? ShieldOff
      : error.code === "network_error"
        ? WifiOff
        : notDeployed
          ? PlugZap
          : AlertTriangle;

  return (
    <Alert variant={notDeployed ? "warning" : "destructive"}>
      <Icon aria-hidden="true" />
      <AlertTitle>
        {notDeployed
          ? `${capitalise(what)} is not available yet`
          : notFound
            ? `${capitalise(what)} has not been configured yet`
            : `Could not load ${what}`}
      </AlertTitle>
      <AlertDescription className="space-y-1">
        <p>
          {notDeployed
            ? "The backend returned 404 for this endpoint."
            : notFound
              ? "Nothing has been saved here yet."
              : error.userMessage}
        </p>
        {error.remedy && !notDeployed && !notFound ? (
          <p className="text-muted-foreground">{error.remedy}</p>
        ) : null}
        {error.traceId ? (
          <p className="font-mono text-xs text-muted-foreground">
            Trace ID: {error.traceId}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
