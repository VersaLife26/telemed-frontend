"use client";

import * as React from "react";
import { AlertOctagon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Button as AdminButton } from "@/components/admin/ui/button";
import { Button } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { SURFACE } from "@/lib/consumer/surface";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (SURFACE === "admin") {
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
              <AdminButton size="sm" onClick={reset}>
                Try again
              </AdminButton>
              <AdminButton size="sm" variant="outline" onClick={() => window.location.reload()}>
                Reload the page
              </AdminButton>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <Card className="mx-auto flex max-w-xl flex-col items-start gap-4">
      <h1 className="text-h3 text-ink">This page failed to load</h1>
      <p className="text-body text-muted">
        Something went wrong while rendering. Your session is unaffected — try again, or
        open another page.
      </p>
      {error.digest ? (
        <p className="font-mono text-caption text-faint">Error digest: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </div>
    </Card>
  );
}
