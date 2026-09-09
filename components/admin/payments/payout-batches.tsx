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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { PayoutBatch } from "@/lib/admin/api/types";
import { formatCount, formatDateTime, formatMoney, shortId } from "@/lib/admin/format";

/**
 * Payout batches.
 *
 * Running one moves real money to real doctors, so it sits behind an
 * AlertDialog rather than a button: no accidental double-click, and the
 * confirmation names what is about to happen. The scheduled 02:00 Colombo cron
 * does this automatically; the manual trigger exists for the morning after a
 * cron that did not fire.
 */
export function PayoutBatches({
  batches,
  readOnly,
}: {
  batches: PayoutBatch[];
  readOnly: boolean;
}) {
  const mutation = useApiMutation<PayoutBatch, void>({
    method: "POST",
    path: () => endpoints.finance.runPayoutBatch(),
    successMessage: () =>
      "Payout batch requested. payment-service performs the transfers and publishes payout.sent per doctor.",
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>Payout batches</CardTitle>
          <CardDescription>
            Runs nightly at 02:00 Colombo time, after the 24-hour hold. Trigger manually
            only when a scheduled run did not happen.
          </CardDescription>
        </div>

        {!readOnly ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={mutation.isPending}>
                <PlayCircle className="size-4" aria-hidden="true" />
                Run a batch now
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Run a payout batch now?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every succeeded payment past its 24-hour hold and not yet paid out will
                  be transferred to the doctor. This moves money and cannot be reversed
                  from the console. If a scheduled batch already ran today, this will
                  find nothing to pay — but check before running it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => mutation.mutate()}>
                  Run the batch
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardHeader>

      <CardContent>
        {batches.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No payout batches yet"
            description="Batches appear here once the nightly job has run at least once."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Doctors</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-mono text-xs" title={batch.id}>
                    {shortId(batch.id)}
                  </TableCell>
                  <TableCell>{formatDateTime(batch.created_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(batch.doctor_count)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(batch.total_cents, batch.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        batch.status === "paid"
                          ? "success"
                          : batch.status === "failed"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {batch.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
