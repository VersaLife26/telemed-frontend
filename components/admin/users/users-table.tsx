"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Activity, CircleSlash, RotateCcw, Search } from "lucide-react";

import { DataTable } from "@/components/admin/data-table/data-table";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/ui/empty-state";
import type { AdminUserRecord } from "@/lib/admin/api/types";
import { formatDate, shortId } from "@/lib/admin/format";

import { SuspensionDialog } from "./suspension-dialog";
import { ActivityDialog } from "./activity-dialog";

/**
 * User search results.
 *
 * What is *not* here is as deliberate as what is. The V2 docs list
 * "impersonate for support (audit logged)" among this screen's capabilities.
 * No impersonation route, table, event subject or RBAC group exists anywhere
 * in telemed-admin-service or telemed-user-service, so there is no button —
 * a control that reliably produces a 404 is worse than an absent one, because
 * it teaches support staff that the console is broken rather than that the
 * feature is unbuilt. It is recorded in the README instead.
 */
export function UsersTable({
  users,
  filtered,
}: {
  users: AdminUserRecord[];
  filtered: boolean;
}) {
  const [suspendTarget, setSuspendTarget] = React.useState<AdminUserRecord | null>(null);
  const [activityTarget, setActivityTarget] = React.useState<AdminUserRecord | null>(null);

  const columns = React.useMemo<ColumnDef<AdminUserRecord, unknown>[]>(
    () => [
      {
        accessorKey: "full_name",
        header: "Name",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.full_name ?? "Unnamed"}</p>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={row.original.user_id}
            >
              {shortId(row.original.user_id)}
            </p>
          </div>
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
              {row.original.phone ?? "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "registered_at",
        header: "Registered",
        cell: ({ row }) => formatDate(row.original.registered_at),
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
              aria-label={`View activity for ${row.original.full_name ?? row.original.user_id}`}
            >
              <Activity className="size-4" aria-hidden="true" />
              Activity
            </Button>
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
        getRowId={(row) => row.user_id}
        caption="Patients and doctors known to the admin console, projected from user-service events. Sorting applies to this page only."
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
              title="Search for a user"
              description="Enter a name, an email address or a phone number above. The console does not list every user by default — an unfiltered dump of the user base is not something an admin should reach for by accident."
            />
          )
        }
      />

      <SuspensionDialog
        user={suspendTarget}
        onClose={() => setSuspendTarget(null)}
      />
      <ActivityDialog user={activityTarget} onClose={() => setActivityTarget(null)} />
    </>
  );
}
