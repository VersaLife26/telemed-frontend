"use client";

import * as React from "react";
import { HandCoins } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import { Badge } from "@/components/admin/ui/badge";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { RefundRequestRecord } from "@/lib/admin/api/types";
import { formatDateTime, formatMoney, shortId } from "@/lib/admin/format";

const MINIMUM_NOTE = 15;

/**
 * Refund approvals.
 *
 * Approving publishes `admin.refund_approved`; payment-service performs the
 * actual refund against Stripe, PayHere or Dialog and publishes
 * `payment.refunded` back. The console therefore never claims the money has
 * moved — it says the approval was recorded, which is the only thing it knows.
 */
export function RefundsPanel({
  refunds,
  readOnly,
}: {
  refunds: RefundRequestRecord[];
  readOnly: boolean;
}) {
  const [target, setTarget] = React.useState<{
    refund: RefundRequestRecord;
    decision: "approved" | "rejected";
  } | null>(null);
  const [note, setNote] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    setNote("");
    setTouched(false);
  }, [target?.refund.id, target?.decision]);

  const tooShort = note.trim().length < MINIMUM_NOTE;

  const mutation = useApiMutation<unknown, { id: string; decision: "approved" | "rejected" }>({
    method: "POST",
    path: (variables) => endpoints.finance.decideRefund(variables.id),
    body: (variables) => ({ decision: variables.decision, note: note.trim() }),
    successMessage: (_result, variables) =>
      variables.decision === "approved"
        ? "Refund approved. payment-service will process it and publish payment.refunded."
        : "Refund request rejected.",
    onSuccess: () => setTarget(null),
  });

  const pending = refunds.filter((refund) => refund.status === "pending");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refund approvals</CardTitle>
        <CardDescription>
          {pending.length} request{pending.length === 1 ? "" : "s"} waiting on a decision.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {refunds.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="No refund requests"
            description="Refund requests are raised from disputes, or directly by support."
          />
        ) : (
          <ul className="space-y-3">
            {refunds.map((refund) => (
              <li
                key={refund.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium tabular-nums">
                    {formatMoney(refund.amount_cents, refund.currency)}
                    <Badge
                      className="ml-2"
                      variant={
                        refund.status === "pending"
                          ? "warning"
                          : refund.status === "approved"
                            ? "success"
                            : "muted"
                      }
                    >
                      {refund.status}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">{refund.reason}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    payment {shortId(refund.payment_id)} · requested{" "}
                    {formatDateTime(refund.requested_at)}
                  </p>
                </div>

                {refund.status === "pending" && !readOnly ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTarget({ refund, decision: "rejected" })}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setTarget({ refund, decision: "approved" })}
                    >
                      Approve
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target?.decision === "approved" ? "Approve" : "Reject"} this refund
            </DialogTitle>
            <DialogDescription>
              {target
                ? `${formatMoney(target.refund.amount_cents, target.refund.currency)} against payment ${shortId(target.refund.payment_id)}.`
                : null}{" "}
              {target?.decision === "approved"
                ? "payment-service performs the refund against the original provider; it is not instant."
                : "The requester is notified, with this note."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="refund-note">
              Note <span aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </Label>
            <Textarea
              id="refund-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && tooShort}
              placeholder="e.g. Consultation did not take place; doctor confirmed no-show on their side. Ticket SUP-4102."
            />
            {touched && tooShort ? (
              <p className="text-xs text-destructive">At least {MINIMUM_NOTE} characters.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Recorded in the audit log against this decision.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              variant={target?.decision === "approved" ? "default" : "destructive"}
              disabled={tooShort || mutation.isPending || !target}
              onClick={() => {
                setTouched(true);
                if (tooShort || !target) return;
                mutation.mutate({ id: target.refund.id, decision: target.decision });
              }}
            >
              {mutation.isPending ? "Submitting…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
