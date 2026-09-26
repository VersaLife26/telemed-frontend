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
import type { LedgerEntry, LedgerTotals } from "@/lib/admin/api/types";
import { formatCount, formatDateTime, formatMoney, humanise, shortId } from "@/lib/admin/format";

export function LedgerTable({
  entries,
  totals,
  filtered,
  exportQuery,
}: {
  entries: LedgerEntry[];
  /** Totals across every entry matching the filter, not just this page. */
  totals: LedgerTotals;
  filtered: boolean;
  /** The current filter, so the export matches what is on screen. */
  exportQuery: string;
}) {
  const [exporting, setExporting] = React.useState(false);

  const columns = React.useMemo<ColumnDef<LedgerEntry, unknown>[]>(
    () => [
      {
        accessorKey: "occurredAt",
        header: "When",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="whitespace-nowrap text-sm">
              {formatDateTime(row.original.occurredAt)}
            </p>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={row.original.paymentId}
            >
              {shortId(row.original.paymentId)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant={row.original.type === "payment" ? "success" : "warning"}>
            {humanise(row.original.type)}
          </Badge>
        ),
      },
      {
        accessorKey: "amountCents",
        header: "Amount",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.amountCents, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "commissionCents",
        header: "Commission",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatMoney(row.original.commissionCents, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "providerFeeCents",
        header: "Provider fee",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatMoney(row.original.providerFeeCents, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: "payoutCents",
        header: "Doctor payout",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.payoutCents, row.original.currency)}
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
    ],
    [],
  );

  const currency = entries[0]?.currency ?? "LKR";
  const summary: Array<[string, string]> = [
    ["Captured", `${formatMoney(totals.capturedCents, currency)} (${formatCount(totals.paymentCount)})`],
    ["Refunded", `${formatMoney(totals.refundedCents, currency)} (${formatCount(totals.refundCount)})`],
    ["Net", formatMoney(totals.netCents, currency)],
    ["Commission", formatMoney(totals.commissionCents, currency)],
    ["Provider fees", formatMoney(totals.providerFeeCents, currency)],
    ["Doctor payouts", formatMoney(totals.payoutCents, currency)],
  ];

  return (
    <>
      <dl className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {summary.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

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
        getRowId={(row) => `${row.type}-${row.id}`}
        caption="Captured payments and refunds, in integer cents converted for display only. Sorting applies to this page; export the CSV for a full-dataset sort."
        emptyState={
          <EmptyState
            icon={Receipt}
            title={filtered ? "No ledger entries match these filters" : "No ledger entries recorded"}
            description={
              filtered
                ? "Widen the date range, or clear the doctor filter."
                : "Captured payments and refunds appear here as they happen."
            }
          />
        }
      />
    </>
  );
}
