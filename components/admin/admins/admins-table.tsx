"use client";

import { useState } from "react";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { useApiMutation } from "@/lib/admin/api/hooks";
import { endpoints } from "@/lib/admin/api/endpoints";
import { ASSIGNABLE_ADMIN_ROLES, type AdminAccount, type AdminRole } from "@/lib/admin/api/types";
import { formatDateTime } from "@/lib/admin/format";

const ROLE_LABELS: Record<AdminRole, string> = {
  support: "Support",
  ops: "Ops",
  finance: "Finance",
  admin: "Admin",
  superAdmin: "Super admin",
};

function RoleSelect({
  account,
  disabled,
}: {
  account: AdminAccount;
  disabled: boolean;
}) {
  const [role, setRole] = useState<AdminRole>(account.role);

  const mutation = useApiMutation<AdminAccount, AdminRole>({
    method: "PATCH",
    path: () => endpoints.adminUsers.update(account.id),
    body: (next) => ({ role: next }),
    successMessage: (_result, next) =>
      `${account.displayName} is now ${ROLE_LABELS[next]}. Their sessions were ended, so it applies immediately.`,
    invalidate: [["admin-users"]],
  });

  return (
    <Select
      value={role}
      disabled={disabled || mutation.isPending}
      onValueChange={(next) => {
        const chosen = next as AdminRole;
        setRole(chosen);
        mutation.mutate(chosen, {
          // Put the control back if the server refused. A picker that keeps
          // showing the new role after a failed save is the same lie this
          // whole screen was built to remove.
          onError: () => setRole(account.role),
        });
      }}
    >
      <SelectTrigger className="w-40" aria-label={`Role for ${account.displayName}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ASSIGNABLE_ADMIN_ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ActiveToggle({
  account,
  disabled,
}: {
  account: AdminAccount;
  disabled: boolean;
}) {
  const mutation = useApiMutation<AdminAccount, boolean>({
    method: account.isActive ? "POST" : "PATCH",
    path: () =>
      account.isActive
        ? endpoints.adminUsers.deactivate(account.id)
        : endpoints.adminUsers.update(account.id),
    body: (active) => (active ? { isActive: true } : undefined),
    successMessage: (_result, active) =>
      active
        ? `${account.displayName} can sign in again.`
        : `${account.displayName} is deactivated and was signed out everywhere.`,
    invalidate: [["admin-users"]],
  });

  return (
    <Button
      variant={account.isActive ? "outline" : "default"}
      size="sm"
      disabled={disabled || mutation.isPending}
      onClick={() => mutation.mutate(!account.isActive)}
    >
      {account.isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}

/**
 * The admin roster.
 *
 * `currentAdminId` is passed so a super admin cannot demote or deactivate
 * themselves. That is a usability guard, not a security control — the server
 * is free to allow it — but locking yourself out of the only surface that can
 * grant access back is a mistake worth making hard to commit by accident.
 */
export function AdminsTable({
  accounts,
  currentAdminId,
}: {
  accounts: AdminAccount[];
  currentAdminId?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last signed in</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => {
            const isSelf = account.id === currentAdminId;
            return (
              <TableRow key={account.id}>
                <TableCell className="font-medium">
                  {account.displayName}
                  {isSelf ? (
                    <span className="text-muted-foreground ml-2 text-sm">(you)</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{account.email}</TableCell>
                <TableCell>
                  <RoleSelect account={account} disabled={isSelf} />
                </TableCell>
                <TableCell>
                  <Badge variant={account.isActive ? "outline" : "destructive"}>
                    {account.isActive ? "Active" : "Deactivated"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "Never"}
                </TableCell>
                <TableCell className="text-right">
                  <ActiveToggle account={account} disabled={isSelf} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
