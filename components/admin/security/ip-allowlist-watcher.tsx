"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Button } from "@/components/admin/ui/button";

type Probe = "checking" | "blocked" | "allowed" | "unknown";

/**
 * Polls `/api/ip-check` so the IP-blocked page updates itself the moment the
 * VPN reconnects.
 *
 * Without this the admin's only move is to reload and hope, which in practice
 * means reloading eight times while the tunnel comes up. Ten seconds is slow
 * enough not to hammer the gateway and fast enough that nobody reaches for the
 * reload button first.
 */
export function IpAllowlistWatcher() {
  const [state, setState] = React.useState<Probe>("checking");

  const check = React.useCallback(async () => {
    setState("checking");
    try {
      const response = await fetch("/api/ip-check", { cache: "no-store" });
      if (!response.ok) {
        setState("unknown");
        return;
      }
      const body = (await response.json()) as { data?: { allowed?: boolean } };
      setState(body.data?.allowed ? "allowed" : "blocked");
    } catch {
      setState("unknown");
    }
  }, []);

  React.useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), 10_000);
    return () => window.clearInterval(id);
  }, [check]);

  if (state === "allowed") {
    return (
      <Alert variant="success">
        <CheckCircle2 aria-hidden="true" />
        <AlertTitle>Your network is allowlisted again</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>The gateway now accepts requests from this address.</p>
          <Button asChild size="sm">
            <Link href="/login">Continue to sign in</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
      aria-live="polite"
    >
      <p className="text-sm text-muted-foreground">
        {state === "checking"
          ? "Checking whether this network is allowlisted…"
          : state === "blocked"
            ? "Still blocked. This page will update on its own when that changes."
            : "Could not reach the gateway to check. It may be down, or unreachable from this network."}
      </p>
      <Button variant="outline" size="sm" onClick={() => void check()} disabled={state === "checking"}>
        {state === "checking" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="size-4" aria-hidden="true" />
        )}
        Check now
      </Button>
    </div>
  );
}
