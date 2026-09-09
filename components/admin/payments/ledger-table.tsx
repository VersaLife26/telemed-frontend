"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Receipt } from "lucide-react";

import { DataTable } from "@/components/admin/data-table/data-table";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { downloadFile } from "@/lib/admin/api/browser";
import { endpoints } from "@/lib/admin/api/endpoints";
import { reportError } from "@/lib/admin/api/hooks";
import type { LedgerEntry } from "@/lib/admin/api/types";
import { formatDateTime, formatMoney, humanise, shortId } from "@/lib/admin/format";

export function LedgerTable({
  entries,
  filtered,
  exportQuery,
}: {
  entries: LedgerEntry[];
  filtered: boolean;
  /** The current filter, so the export matches what is on screen. */
  exportQuery: string;
}) {
  const [exporting, setExporting] = React.useState(false);

  const columns = React.useMemo<ColumnDef<LedgerEntry, unknown>[]>(
    () => [
      {
        accessorKey: "occurred_at",
        header: "When",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-sm">
              {formatDateTime(row.original.occurred_at)}
            </p>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={row.original.payment_id}
            >
              {shortId(row.original.payment_id)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "amount_cents",
        header: "Amount",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.amount_cents, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "commission_cents",
        header: "Commission",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatMoney(row.original.commission_cents, row.original.currency)}
          </span>
        ),
      },
      {
        id: "payout",
        header: "Doctor payout",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(
              row.original.amount_cents - row.original.commission_cents,
              row.original.currency,
            )}
          </span>
        ),
      },
      {
        accessorKey: "provider",
        header: "Provider",
        cell: ({ row }) =>
          row.original.provider ? (
            <Badge variant="outline">{humanise(row.original.provider)}</Badge>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "specialty_code",
        header: "Specialty",
        cell: ({ row }) =>
          row.original.specialty_code ? humanise(row.original.specialty_code) : "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge
              variant={
                status === "succeeded"
                  ? "success"
                  : status === "refunded"
                    ? "warning"
                    : "destructive"
              }
            >
              {humanise(status)}
            </Badge>
          );
        },
      },
    ],
    [],
  );

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await downloadFile(
                endpoints.finance.ledgerExport(new URLSearchParams(exportQuery)),
                `telemed-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
              );
            } catch (error) {
              reportError(error);
            } finally {
              setExporting(false);
            }
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          {exporting ? "Preparing…" : "Export CSV"}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={entries}
        getRowId={(row) => row.payment_id}
        caption="Payments recorded against the platform, in integer cents converted for display only. Sorting applies to this page; export the CSV for a full-dataset sort."
        emptyState={
          <EmptyState
            icon={Receipt}
            title={filtered ? "No payments match these filters" : "No payments recorded"}
            description={
              filtered
                ? "Widen the date range, or clear the provider and status filters."
                : "The payment projection is fed by payment.succeeded, payment.failed and payment.refunded events from payment-service."
            }
          />
        }
      />
    </>
  );
}
