import { AlertTriangle, PlugZap, ShieldOff, WifiOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import type { ApiError } from "@/lib/admin/api/errors";

/**
 * How a failed fetch looks on a page.
 *
 * Three things are always present: what happened in the admin's own terms,
 * what to do about it, and the request id. The request id is what turns
 * "payments is broken" into a ticket someone can actually trace through the
 * gateway log, the service log and the OTel span.
 *
 * NOT_FOUND gets its own wording. Several admin endpoints in this console are
 * defined by the V2 docs and by telemed-admin-service's schema but are not
 * mounted in that service's router yet; saying "not deployed yet" is honest,
 * and it is very different information from "this record was deleted".
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
  const notFound = error.code === "NOT_FOUND";
  const notDeployed = notFound && !missingRecord;
  const Icon =
    error.code === "IP_NOT_ALLOWLISTED"
      ? ShieldOff
      : error.code === "NETWORK_ERROR"
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
            ? "The backend returned 404 for this endpoint. It is defined in the admin service's schema but its route is not mounted yet."
            : notFound
              ? "No version exists for this configuration key yet. Save a first version from the editor below, or ask ops to seed platform defaults."
              : error.userMessage}
        </p>
        {error.remedy && !notDeployed && !notFound ? (
          <p className="text-muted-foreground">{error.remedy}</p>
        ) : null}
        {error.requestId ? (
          <p className="font-mono text-xs text-muted-foreground">
            Request ID: {error.requestId}
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
