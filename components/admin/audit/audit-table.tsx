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
import { DiffView } from "@/components/admin/payments/diff-view";
import { downloadFile } from "@/lib/admin/api/browser";
import { endpoints } from "@/lib/admin/api/endpoints";
import { reportError } from "@/lib/admin/api/hooks";
import type { AuditEntry } from "@/lib/admin/api/types";
import { formatDateTime, humanise, shortId } from "@/lib/admin/format";

/**
 * The audit log.
 *
 * Each row can be opened to see the before/after values as a diff. That is the
 * whole reason `old_value` and `new_value` are stored as JSONB rather than as a
 * rendered sentence — "commission rules changed" is not evidence, and a diff
 * between two JSON documents is.
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
   * Whether the signed-in admin holds `finance` or `super_admin`. Computed
   * server-side from the session, never from anything the browser can set.
   *
   * Hiding the button is a courtesy, not the control: admin-service gates
   * `GET /audit/export` on `GroupAuditExport` and the BFF proxy applies the
   * same matrix. Before this prop existed the console offered the export to
   * all five roles and three of them got a 403 toast, which reads as a broken
   * console rather than as a boundary.
   */
  canExport: boolean;
}) {
  const [selected, setSelected] = React.useState<AuditEntry | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const columns = React.useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "When",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {formatDateTime(row.original.created_at)}
          </span>
        ),
      },
      {
        accessorKey: "actor_role",
        header: "Actor",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Badge variant="outline">{row.original.actor_role}</Badge>
            {row.original.actor_id ? (
              <p
                className="mt-0.5 truncate font-mono text-xs text-muted-foreground"
                title={row.original.actor_id}
              >
                {shortId(row.original.actor_id)}
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
        accessorKey: "resource_type",
        header: "Resource",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm">{humanise(row.original.resource_type)}</p>
            {row.original.resource_id ? (
              <p
                className="truncate font-mono text-xs text-muted-foreground"
                title={row.original.resource_id}
              >
                {shortId(row.original.resource_id)}
              </p>
            ) : null}
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
        caption="Admin actions, newest first. The table is append-only in the database; nothing shown here can be edited or deleted through any console route."
        emptyState={
          <EmptyState
            icon={ScrollText}
            title={filtered ? "No entries match these filters" : "No audit entries"}
            description={
              filtered
                ? "Widen the date range, or clear the actor and action filters."
                : "Nothing has been done through the console yet. Every state-changing admin action writes a row here."
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
                  {formatDateTime(selected.created_at)} · {selected.actor_role}
                  {selected.request_id ? (
                    <>
                      {" · "}
                      <span className="font-mono">request {selected.request_id}</span>
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
                <Field label="Resource" value={`${selected.resource_type} ${selected.resource_id ?? ""}`} />
                <Field label="Source address" value={selected.ip ?? "—"} />
                <Field label="User agent" value={selected.user_agent ?? "—"} />
                <Field label="Previous hash" value={selected.prev_hash} mono />
                <Field label="Row hash" value={selected.row_hash} mono />
              </dl>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">What changed</h3>
                <DiffView
                  before={render(selected.old_value)}
                  after={render(selected.new_value)}
                  beforeLabel="Before"
                  afterLabel="After"
                />
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

function render(value: unknown): string {
  if (value === undefined || value === null) return "";
  return `${JSON.stringify(value, null, 2)}\n`;
}
