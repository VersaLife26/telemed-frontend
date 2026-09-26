"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Activity, CircleSlash, RotateCcw, Search } from "lucide-react";

import { DataTable } from "@/components/admin/data-table/data-table";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/ui/empty-state";
import type { PlatformUser } from "@/lib/admin/api/types";
import { formatDate, shortId } from "@/lib/admin/format";

import { SuspensionDialog } from "./suspension-dialog";
import { ActivityDialog } from "./activity-dialog";
import { UserDetailDialog } from "./user-detail-dialog";

/**
 * User search results.
 *
 * There is deliberately no impersonation button: the API has no route for it,
 * and a control that reliably fails teaches support staff that the console is
 * broken rather than that the feature is unbuilt.
 */
export function UsersTable({
  users,
  filtered,
}: {
  users: PlatformUser[];
  filtered: boolean;
}) {
  const [suspendTarget, setSuspendTarget] = React.useState<PlatformUser | null>(null);
  const [activityTarget, setActivityTarget] = React.useState<PlatformUser | null>(null);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const columns = React.useMemo<ColumnDef<PlatformUser, unknown>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Name",
        cell: ({ row }) => (
          <button
            type="button"
            className="min-w-0 text-left"
            onClick={() => setDetailId(row.original.id)}
          >
            <p className="truncate font-medium">{row.original.fullName || "Unnamed"}</p>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={row.original.id}
            >
              {shortId(row.original.id)}
            </p>
          </button>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <Badge variant="outline">
            {row.original.role === "doctor" ? "Doctor" : "Patient"}
          </Badge>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0 text-sm">
            <p className="truncate">{row.original.email ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.phoneNumber ?? "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Registered",
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.status === "suspended" ? (
            <Badge variant="destructive">
              <CircleSlash className="size-3" aria-hidden="true" />
              Suspended
            </Badge>
          ) : row.original.status === "deleted" ? (
            <Badge variant="outline">Deleted</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActivityTarget(row.original)}
              aria-label={`View activity for ${row.original.fullName || row.original.id}`}
            >
              <Activity className="size-4" aria-hidden="true" />
              Activity
            </Button>
            {row.original.status === "deleted" ? null : (
            <Button
              variant={row.original.status === "suspended" ? "outline" : "destructive"}
              size="sm"
              onClick={() => setSuspendTarget(row.original)}
            >
              {row.original.status === "suspended" ? (
                <>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Reinstate
                </>
              ) : (
                <>
                  <CircleSlash className="size-4" aria-hidden="true" />
                  Suspend
                </>
              )}
            </Button>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={users}
        getRowId={(row) => row.id}
        caption="Patients and doctors registered on the platform. Sorting applies to this page only."
        emptyState={
          filtered ? (
            <EmptyState
              icon={Search}
              title="No users match this search"
              description="Search matches name, email and phone. Phone numbers are stored in +947XXXXXXXX form."
            />
          ) : (
            <EmptyState
              icon={Search}
              title="No users yet"
              description="Patients and doctors appear here after they register. Use the filters above to narrow the list."
            />
          )
        }
      />

      <SuspensionDialog
        user={suspendTarget}
        onClose={() => setSuspendTarget(null)}
      />
      <ActivityDialog user={activityTarget} onClose={() => setActivityTarget(null)} />
      <UserDetailDialog userId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
