"use client";

import * as React from "react";
import { CircleCheck, Link2Off, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { ChainVerifyResult } from "@/lib/admin/api/types";
import { formatCount } from "@/lib/admin/format";

/**
 * Hash-chain integrity check.
 *
 * `audit_logs` is append-only three ways over: the application role has no
 * UPDATE or DELETE grant, a trigger raises on either regardless of role, and
 * every row carries a SHA-256 chain (`prev_hash`/`row_hash`) so a mutation that
 * defeated both — a superuser disabling the trigger, say — is still detectable
 * by walking the chain.
 *
 * This button walks it. The backend verifies in bounded batches and returns a
 * `next_from_id` cursor rather than scanning a table that will eventually have
 * tens of millions of rows in one request; this component follows the cursor
 * until the chain ends or a break is found, and shows progress while it does.
 *
 * A break is reported loudly and specifically: the row id where the chain
 * stopped checking out is the only piece of information that makes the next
 * step — reading that row and the one before it — possible.
 */
export function ChainVerifyCard() {
  const [checked, setChecked] = React.useState(0);
  const [cursor, setCursor] = React.useState<number | null>(null);
  const [result, setResult] = React.useState<ChainVerifyResult | null>(null);
  const [running, setRunning] = React.useState(false);

  const mutation = useApiMutation<ChainVerifyResult, { fromId: number }>(
    {
      method: "POST",
      path: () => endpoints.audit.verify(),
      body: (variables) => ({ from_id: variables.fromId, limit: 5000 }),
      refreshRoute: false,
    },
    {
      onSuccess: (data) => {
        setResult(data);
        setChecked((total) => total + data.checked);
        if (data.valid && typeof data.next_from_id === "number") {
          setCursor(data.next_from_id);
        } else {
          setCursor(null);
          setRunning(false);
        }
      },
      onError: () => setRunning(false),
    },
  );

  // Follow the cursor. Written as an effect rather than a loop inside the
  // mutation so each batch is a separate render — the counter below actually
  // moves instead of jumping from 0 to done.
  React.useEffect(() => {
    if (!running || cursor === null || mutation.isPending) return;
    mutation.mutate({ fromId: cursor });
    // The mutation object is recreated on every render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, cursor]);

  const start = () => {
    setChecked(0);
    setResult(null);
    setRunning(true);
    setCursor(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chain integrity</CardTitle>
        <CardDescription>
          Every audit row carries the SHA-256 hash of the row before it. Verifying walks
          the chain from the beginning and reports the first row where it no longer
          checks out.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <Button onClick={start} disabled={running || mutation.isPending}>
          <ShieldCheck className="size-4" aria-hidden="true" />
          {running || mutation.isPending ? "Verifying…" : "Verify chain integrity"}
        </Button>

        <div aria-live="polite" className="space-y-3">
          {running || mutation.isPending ? (
            <p className="text-sm text-muted-foreground tabular-nums">
              Checked {formatCount(checked)} rows…
            </p>
          ) : null}

          {result && !running && !mutation.isPending ? (
            result.valid ? (
              <Alert variant="success">
                <CircleCheck aria-hidden="true" />
                <AlertTitle>
                  Chain intact across {formatCount(checked)} rows
                </AlertTitle>
                <AlertDescription>
                  Every row&rsquo;s recorded hash matches the hash computed from its
                  contents and its predecessor. Nothing has been altered or removed.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <Link2Off aria-hidden="true" />
                <AlertTitle>
                  Chain broken at row {result.broken?.id ?? "unknown"}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{result.broken?.reason ?? "The chain did not verify."}</p>
                  <p>
                    This means the audit log has been altered below the application
                    layer — the application role holds no UPDATE or DELETE grant and a
                    trigger blocks both. Treat it as a security incident: preserve the
                    database, do not run further writes against it, and escalate.
                  </p>
                  <p className="tabular-nums">
                    {formatCount(checked)} rows were checked before the break.
                  </p>
                </AlertDescription>
              </Alert>
            )
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
