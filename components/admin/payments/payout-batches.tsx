"use client";

import * as React from "react";
import { Banknote, PlayCircle } from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/admin/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation, useApiQuery } from "@/lib/admin/api/hooks";
import type { Payout, PayoutBatch, PayoutBatchDetail, PayoutRun } from "@/lib/admin/api/types";
import { formatCount, formatDate, formatDateTime, formatMoney, humanise } from "@/lib/admin/format";

function statusVariant(status: string) {
  return status === "paid" ? "success" : status === "failed" ? "destructive" : "warning";
}

/**
 * Payout batches.
 *
 * Running one creates the payouts for a closed day, so it sits behind an
 * AlertDialog rather than a button: no accidental double-click, and the
 * confirmation names what is about to happen. Transfers themselves happen
 * outside the platform; each payout is then marked paid (with the bank
 * reference) or failed here.
 */
export function PayoutBatches({ batches }: { batches: PayoutBatch[] }) {
  const [date, setDate] = React.useState("");
  const [openBatch, setOpenBatch] = React.useState<string | null>(null);

  const run = useApiMutation<PayoutRun, void>({
    method: "POST",
    path: () => endpoints.finance.runPayouts(),
    body: () => ({ date: date || null }),
    successMessage: (result) =>
      result.created
        ? `Payout batch created for ${formatDate(result.period)}.`
        : `Nothing new to pay out for ${formatDate(result.period)}.`,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>Payout batches</CardTitle>
          <CardDescription>
            One batch per closed day, after the payout hold. Trigger manually only when a
            scheduled run did not happen.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="payout-date">Day (default yesterday)</Label>
            <Input id="payout-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={run.isPending}>
                <PlayCircle className="size-4" aria-hidden="true" />
                Run payouts
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Run payouts for {date ? formatDate(date) : "yesterday"}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every captured payment from that day that is past its hold and not yet
                  paid out is grouped into one payout per doctor. If a batch already
                  exists for that day, nothing new is created.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => run.mutate()}>Run payouts</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent>
        {batches.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No payout batches yet"
            description="Batches appear here once payouts have run at least once."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Payouts</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell>
                    {batch.periodStart === batch.periodEnd
                      ? formatDate(batch.periodStart)
                      : `${formatDate(batch.periodStart)} – ${formatDate(batch.periodEnd)}`}
                  </TableCell>
                  <TableCell>{formatDateTime(batch.createdAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(batch.payoutCount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(batch.totalCents)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(batch.status)}>{humanise(batch.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setOpenBatch(batch.id)}>
                      Payouts
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={openBatch !== null} onOpenChange={(open) => !open && setOpenBatch(null)}>
        <DialogContent className="max-w-3xl">
          {openBatch ? <BatchDetail batchId={openBatch} /> : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function BatchDetail({ batchId }: { batchId: string }) {
  const detail = useApiQuery<PayoutBatchDetail>(
    ["payout-batch", batchId],
    endpoints.finance.payoutBatch(batchId),
  );
  const [target, setTarget] = React.useState<{ payout: Payout; action: "paid" | "failed" } | null>(
    null,
  );
  const [text, setText] = React.useState("");

  const mark = useApiMutation<Payout, { id: string; action: "paid" | "failed"; text: string }>({
    method: "POST",
    path: (v) =>
      v.action === "paid" ? endpoints.finance.markPayoutPaid(v.id) : endpoints.finance.markPayoutFailed(v.id),
    body: (v) => (v.action === "paid" ? { transferReference: v.text } : { reason: v.text }),
    successMessage: (_r, v) => (v.action === "paid" ? "Payout marked paid." : "Payout marked failed."),
    invalidate: [["payout-batch", batchId]],
    onSuccess: () => {
      setTarget(null);
      setText("");
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Payouts in this batch</DialogTitle>
        <DialogDescription>
          Mark each payout paid once the bank transfer has gone out, with its reference.
        </DialogDescription>
      </DialogHeader>

      {detail.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : detail.isError ? (
        <p className="text-sm text-destructive">{detail.error.userMessage}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doctor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.data.payouts.map((payout) => (
              <TableRow key={payout.id}>
                <TableCell>
                  <p>{payout.doctorName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCount(payout.paymentCount)} payment{payout.paymentCount === 1 ? "" : "s"}
                    {payout.transferReference ? ` · ref ${payout.transferReference}` : ""}
                    {payout.failureReason ? ` · ${payout.failureReason}` : ""}
                  </p>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(payout.amountCents, payout.currency)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(payout.status)}>{humanise(payout.status)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {payout.status === "pending" ? (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setTarget({ payout, action: "failed" })}>
                        Failed
                      </Button>
                      <Button size="sm" onClick={() => setTarget({ payout, action: "paid" })}>
                        Paid
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {target ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label htmlFor="payout-mark-text">
            {target.action === "paid"
              ? `Transfer reference for ${target.payout.doctorName}`
              : `Why the transfer to ${target.payout.doctorName} failed`}
          </Label>
          <Input id="payout-mark-text" value={text} onChange={(event) => setText(event.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={mark.isPending}>
              Cancel
            </Button>
            <Button
              variant={target.action === "paid" ? "default" : "destructive"}
              disabled={mark.isPending || text.trim() === ""}
              onClick={() => mark.mutate({ id: target.payout.id, action: target.action, text: text.trim() })}
            >
              {target.action === "paid" ? "Mark paid" : "Mark failed"}
            </Button>
          </DialogFooter>
        </div>
      ) : null}
    </>
  );
}
