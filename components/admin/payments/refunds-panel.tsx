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
import type { AdminRefund } from "@/lib/admin/api/types";
import { formatDateTime, formatMoney, humanise, shortId } from "@/lib/admin/format";

const MINIMUM_NOTE = 15;

type Action = "approve" | "reject" | "markRefunded";

const TITLES: Record<Action, string> = {
  approve: "Approve this refund",
  reject: "Reject this refund",
  markRefunded: "Mark this refund as paid manually",
};

/**
 * Refund approvals.
 *
 * Approving hands the refund to the payment provider; it is not instant, so
 * the console says the approval was recorded rather than that money moved. A
 * refund the provider cannot perform lands in `manualRequired` and is closed
 * here with the reference of the manual transfer.
 */
export function RefundsPanel({ refunds }: { refunds: AdminRefund[] }) {
  const [target, setTarget] = React.useState<{ refund: AdminRefund; action: Action } | null>(null);
  const [note, setNote] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    setNote("");
    setTouched(false);
  }, [target?.refund.id, target?.action]);

  const needsText = target?.action === "reject" || target?.action === "markRefunded";
  const minimum = target?.action === "reject" ? MINIMUM_NOTE : 1;
  const tooShort = needsText && note.trim().length < minimum;

  const mutation = useApiMutation<AdminRefund, { id: string; action: Action; text: string }>({
    method: "POST",
    path: (v) =>
      v.action === "approve"
        ? endpoints.finance.approveRefund(v.id)
        : v.action === "reject"
          ? endpoints.finance.rejectRefund(v.id)
          : endpoints.finance.markRefunded(v.id),
    body: (v) =>
      v.action === "reject"
        ? { reason: v.text }
        : v.action === "markRefunded"
          ? { reference: v.text }
          : undefined,
    successMessage: (_result, v) =>
      v.action === "approve"
        ? "Refund approved. The provider processes it; it is not instant."
        : v.action === "reject"
          ? "Refund request rejected."
          : "Refund marked as paid.",
    onSuccess: () => setTarget(null),
  });

  const pending = refunds.filter((refund) => refund.status === "requested" || refund.status === "manualRequired");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refund approvals</CardTitle>
        <CardDescription>
          {pending.length} refund{pending.length === 1 ? "" : "s"} waiting on an admin.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {refunds.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="No refunds"
            description="Refunds are raised by cancellations, disputes, or directly by support."
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
                    {formatMoney(refund.amountCents, refund.currency)}
                    <Badge
                      className="ml-2"
                      variant={
                        refund.status === "requested" || refund.status === "manualRequired"
                          ? "warning"
                          : refund.status === "succeeded" || refund.status === "approved"
                            ? "success"
                            : refund.status === "failed"
                              ? "destructive"
                              : "muted"
                      }
                    >
                      {humanise(refund.status)}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {humanise(refund.reason)} · {refund.percent}%
                    {refund.note ? ` · ${refund.note}` : ""}
                  </p>
                  {refund.failureReason || refund.rejectionReason ? (
                    <p className="text-sm text-destructive">
                      {refund.failureReason ?? refund.rejectionReason}
                    </p>
                  ) : null}
                  <p className="font-mono text-xs text-muted-foreground">
                    payment {shortId(refund.paymentId)} · requested{" "}
                    {formatDateTime(refund.createdAt)}
                  </p>
                </div>

                {refund.status === "requested" ? (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => setTarget({ refund, action: "reject" })}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => setTarget({ refund, action: "approve" })}>
                      Approve
                    </Button>
                  </div>
                ) : refund.status === "manualRequired" ? (
                  <Button size="sm" onClick={() => setTarget({ refund, action: "markRefunded" })}>
                    Mark refunded
                  </Button>
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
            <DialogTitle>{target ? TITLES[target.action] : null}</DialogTitle>
            <DialogDescription>
              {target
                ? `${formatMoney(target.refund.amountCents, target.refund.currency)} against payment ${shortId(target.refund.paymentId)}.`
                : null}{" "}
              {target?.action === "approve"
                ? "The provider performs the refund against the original payment; it is not instant."
                : target?.action === "markRefunded"
                  ? "Only do this once the money has been returned outside the platform."
                  : "Recorded in the audit log against this decision."}
            </DialogDescription>
          </DialogHeader>

          {needsText ? (
            <div className="space-y-2">
              <Label htmlFor="refund-note">
                {target?.action === "reject" ? "Reason" : "Transfer reference"}{" "}
                <span aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </Label>
              <Textarea
                id="refund-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && tooShort}
              />
              {touched && tooShort ? (
                <p className="text-xs text-destructive">At least {minimum} characters.</p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              variant={target?.action === "reject" ? "destructive" : "default"}
              disabled={tooShort || mutation.isPending || !target}
              onClick={() => {
                setTouched(true);
                if (tooShort || !target) return;
                mutation.mutate({ id: target.refund.id, action: target.action, text: note.trim() });
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
