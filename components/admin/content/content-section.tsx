"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Pencil, Plus } from "lucide-react";

import { DataTable } from "@/components/admin/data-table/data-table";
import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/ui/empty-state";
import type { ApiError } from "@/lib/admin/api/errors";
import { useApiMutation } from "@/lib/admin/api/hooks";

import { EntityEditor, type FieldSpec, type FieldValue } from "./entity-editor";

/** Table plus create/edit dialog, shared by the content types. */
export function ContentSection<T>({
  title,
  description,
  rows,
  columns,
  fields,
  toFormValues,
  toPayload,
  rowId,
  createPath,
  updatePath,
  singular,
  readOnly,
}: {
  title: string;
  description: string;
  rows: T[];
  columns: ColumnDef<T, unknown>[];
  fields: readonly FieldSpec[];
  toFormValues: (row: T | null) => Record<string, FieldValue>;
  /** `row` is the record being edited, or null when creating. */
  toPayload: (values: Record<string, FieldValue>, row: T | null) => Record<string, unknown>;
  rowId: (row: T) => string;
  createPath: string;
  updatePath: (id: string) => string;
  singular: string;
  readOnly: boolean;
}) {
  const [editing, setEditing] = React.useState<T | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [serverError, setServerError] = React.useState<ApiError | null>(null);

  const close = () => {
    setEditing(null);
    setCreating(false);
    setServerError(null);
  };

  const createMutation = useApiMutation<T, Record<string, FieldValue>>(
    {
      method: "POST",
      path: () => createPath,
      body: (values) => toPayload(values, null),
      successMessage: () => `${singular} created.`,
      onSuccess: close,
    },
    { onError: (error) => setServerError(error) },
  );

  const updateMutation = useApiMutation<T, Record<string, FieldValue>>(
    {
      method: "PUT",
      path: () => updatePath(editing ? rowId(editing) : ""),
      body: (values) => toPayload(values, editing),
      successMessage: () => `${singular} updated.`,
      onSuccess: close,
    },
    { onError: (error) => setServerError(error) },
  );

  const columnsWithActions = React.useMemo<ColumnDef<T, unknown>[]>(
    () => [
      ...columns,
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={() => {
                setServerError(null);
                setEditing(row.original);
              }}
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [columns, readOnly],
  );

  const open = creating || editing !== null;
  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          size="sm"
          disabled={readOnly}
          onClick={() => {
            setServerError(null);
            setCreating(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          New {singular.toLowerCase()}
        </Button>
      </div>

      <DataTable
        columns={columnsWithActions}
        data={rows}
        getRowId={rowId}
        caption={title}
        emptyState={
          <EmptyState
            icon={FileText}
            title={`No ${title.toLowerCase()} yet`}
            description={`Create the first ${singular.toLowerCase()} with the button above.`}
          />
        }
      />

      <EntityEditor
        open={open}
        editing={editing !== null}
        title={creating ? `New ${singular.toLowerCase()}` : `Edit ${singular.toLowerCase()}`}
        fields={fields}
        initial={toFormValues(editing)}
        submitLabel={creating ? "Create" : "Save changes"}
        pending={pending}
        serverError={serverError}
        onCancel={close}
        onSubmit={(values) =>
          creating ? createMutation.mutate(values) : updateMutation.mutate(values)
        }
      />
    </section>
  );
}
