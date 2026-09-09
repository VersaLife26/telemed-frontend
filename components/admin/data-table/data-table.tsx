"use client";

import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { cn } from "@/lib/admin/utils";

/**
 * The console's table.
 *
 * TanStack Table v8 supplies the model; the markup is a real `<table>` so the
 * semantics come from HTML rather than from ARIA patched on afterwards.
 *
 * Sorting is client-side over the current page only, and the caption says so.
 * Sorting a 25-row page and calling it "sorted by revenue" when the other
 * 4,000 rows are on other pages would be actively misleading, so screens whose
 * ordering matters push the sort into the query string instead.
 */
export function DataTable<TData>({
  columns,
  data,
  caption,
  emptyState,
  getRowId,
  onRowClick,
  rowLabel,
  initialSorting,
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Describes the table for assistive tech. Rendered visibly below it. */
  caption: string;
  emptyState: React.ReactNode;
  getRowId?: (row: TData, index: number) => string;
  onRowClick?: (row: TData) => void;
  /** Accessible name for the row when rows are activatable. */
  rowLabel?: (row: TData) => string;
  initialSorting?: SortingState;
}) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting ?? []);

  // react-hooks/incompatible-library: the React Compiler declines to memoize a
  // component that calls useReactTable, because the table instance hands back
  // functions it cannot prove are stable. That is correct and expected — the
  // consequence is that this component is not auto-memoized, which for a table
  // that re-renders on sort is the behaviour we want anyway.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(getRowId ? { getRowId } : {}),
  });

  if (data.length === 0) return <>{emptyState}</>;

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableCaption className="px-3 pb-3 text-left">{caption}</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const direction = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    style={header.column.columnDef.size ? { width: header.column.columnDef.size } : undefined}
                    // aria-sort is what a screen reader reads out; the icon is
                    // for everyone else.
                    aria-sort={
                      !sortable
                        ? undefined
                        : direction === "asc"
                          ? "ascending"
                          : direction === "desc"
                            ? "descending"
                            : "none"
                    }
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 rounded-sm hover:text-foreground"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {direction === "asc" ? (
                          <ArrowUp className="size-3" aria-hidden="true" />
                        ) : direction === "desc" ? (
                          <ArrowDown className="size-3" aria-hidden="true" />
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-50" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              {...(onRowClick
                ? {
                    // A clickable row must also be reachable and activatable by
                    // keyboard, and must announce what it is.
                    tabIndex: 0,
                    role: "button",
                    "aria-label": rowLabel?.(row.original),
                    className: "cursor-pointer",
                    onClick: () => onRowClick(row.original),
                    onKeyDown: (event: React.KeyboardEvent) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRowClick(row.original);
                      }
                    },
                  }
                : {})}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
