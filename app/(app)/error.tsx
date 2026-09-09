"use client";

import * as React from "react";
import { AlertOctagon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Button } from "@/components/admin/ui/button";

/**
 * Route-level error boundary.
 *
 * Next.js strips the message from a server-thrown error in production and
 * leaves only `digest`. That digest is the only thing that correlates what the
 * admin saw with the server log line, so it is shown rather than hidden — an
 * opaque code someone can quote beats a friendly sentence nobody can trace.
 */
export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <Alert variant="destructive">
        <AlertOctagon aria-hidden="true" />
        <AlertTitle>This page failed to load</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            Something went wrong while rendering. Your session is unaffected — you can
            retry, or move to another page.
          </p>
          {error.digest ? (
            <p className="font-mono text-xs">Error digest: {error.digest}</p>
          ) : null}
          <div className="flex gap-2">
            <Button size="sm" onClick={reset}>
              Try again
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Reload the page
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
