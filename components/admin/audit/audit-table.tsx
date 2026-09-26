"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, ScrollText } from "lucide-react";

import { DataTable } from "@/components/admin/data-table/data-table";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { downloadFile } from "@/lib/admin/api/browser";
import { endpoints } from "@/lib/admin/api/endpoints";
import { reportError } from "@/lib/admin/api/hooks";
import type { AuditEntry } from "@/lib/admin/api/types";
import { formatDateTime, humanise, shortId } from "@/lib/admin/format";

/**
 * The audit log.
 *
 * Each row can be opened to see the recorded `changes` document. "Commission
 * changed" is not evidence; the JSON of what changed is.
 */
export function AuditTable({
  entries,
  filtered,
  exportQuery,
  canExport,
}: {
  entries: AuditEntry[];
  filtered: boolean;
  exportQuery: string;
  /**
   * Whether the signed-in admin holds the `auditExport` permission. Computed
   * server-side from the session, never from anything the browser can set.
   *
   * Hiding the button is a courtesy, not the control: the API gates
   * `GET /audit.csv` on `auditExport` and the BFF proxy applies the same
   * matrix.
   */
  canExport: boolean;
}) {
  const [selected, setSelected] = React.useState<AuditEntry | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const columns = React.useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "When",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "actorType",
        header: "Actor",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Badge variant="outline">{row.original.actorType}</Badge>
            {row.original.actorEmail || row.original.actorId ? (
              <p
                className="mt-0.5 truncate font-mono text-xs text-muted-foreground"
                title={row.original.actorEmail ?? row.original.actorId ?? undefined}
              >
                {row.original.actorEmail ?? shortId(row.original.actorId)}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => <code className="text-xs">{row.original.action}</code>,
      },
      {
        accessorKey: "entityType",
        header: "Entity",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm">{humanise(row.original.entityType)}</p>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={row.original.entityId}
            >
              {shortId(row.original.entityId)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "ip",
        header: "From",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.ip ?? "—"}</span>
        ),
      },
      {
        id: "detail",
        header: "Detail",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setSelected(row.original)}>
              Inspect
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <div className="mb-3 flex justify-end">
        {canExport ? (
        <Button
          variant="outline"
          size="sm"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await downloadFile(
                endpoints.audit.export(new URLSearchParams(exportQuery)),
                `telemed-audit-${new Date().toISOString().slice(0, 10)}.csv`,
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
        ) : (
          <p className="text-xs text-muted-foreground">
            Exporting the whole trail requires the finance or super admin role.
          </p>
        )}
      </div>

      <DataTable
        columns={columns}
        data={entries}
        getRowId={(row) => String(row.id)}
        caption="Audit entries, newest first. Nothing shown here can be edited or deleted through any console route."
        emptyState={
          <EmptyState
            icon={ScrollText}
            title={filtered ? "No entries match these filters" : "No audit entries"}
            description={
              filtered
                ? "Widen the date range, or clear the actor and action filters."
                : "Nothing has been recorded yet. Every state-changing action writes a row here."
            }
          />
        }
      />

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selected ? humanise(selected.action) : "Audit entry"}</DialogTitle>
            <DialogDescription>
              {selected ? (
                <>
                  {formatDateTime(selected.createdAt)} · {selected.actorEmail ?? selected.actorType}
                  {selected.requestId ? (
                    <>
                      {" · "}
                      <span className="font-mono">request {selected.requestId}</span>
                    </>
                  ) : null}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Row id" value={String(selected.id)} />
                <Field label="Entity" value={`${selected.entityType} ${selected.entityId}`} />
                <Field label="Actor id" value={selected.actorId ?? "—"} mono />
                <Field label="Source address" value={selected.ip ?? "—"} />
              </dl>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">What changed</h3>
                <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
                  {JSON.stringify(selected.changes, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-all font-mono text-xs" : "break-words"}>{value}</dd>
    </div>
  );
}
