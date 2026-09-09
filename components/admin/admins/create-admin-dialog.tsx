"use client";

import { useState } from "react";

import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import {
  ASSIGNABLE_ADMIN_ROLES,
  type AdminAccount,
  type AssignableAdminRole,
} from "@/lib/admin/api/types";

const ROLE_LABELS: Record<AssignableAdminRole, string> = {
  support: "Support",
  ops: "Ops",
  finance: "Finance",
  admin: "Admin",
  super_admin: "Super admin",
};

const ROLE_HINTS: Record<AssignableAdminRole, string> = {
  support: "Patient support and disputes. Cannot move money or change settings.",
  ops: "Day-to-day operations, plus platform settings.",
  finance: "Refunds, payouts, the ledger and commission rules.",
  admin: "General administration. No finance, no admin accounts.",
  super_admin: "Everything, including creating and re-roling admins. Grant sparingly.",
};

/**
 * Create a colleague's admin account.
 *
 * There is no password field, and that is deliberate rather than unfinished.
 * admin-service hands Keycloak three required actions — set a password,
 * enrol TOTP, verify the email address — which the new admin completes on
 * first sign-in. So this platform never generates, transmits, stores or logs
 * an admin password, and there is no temporary credential sitting in an inbox
 * waiting to be found.
 */
export function CreateAdminDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AssignableAdminRole>("support");

  const mutation = useApiMutation<AdminAccount, void>({
    method: "POST",
    path: () => endpoints.adminUsers.create(),
    body: () => ({ email: email.trim(), display_name: displayName.trim(), role }),
    successMessage: (created) =>
      `${created.display_name} was created. They set their own password and enrol two-factor on first sign-in.`,
    invalidate: [["admin-users"]],
  });

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailOk && displayName.trim().length > 0 && !mutation.isPending;

  function reset() {
    setEmail("");
    setDisplayName("");
    setRole("support");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>Add admin</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an admin</DialogTitle>
          <DialogDescription>
            Creates their sign-in and their console account together. They choose
            their own password and set up two-factor the first time they sign in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-name">Full name</Label>
            <Input
              id="admin-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Nadeesha Perera"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-email">Work email</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@yourclinic.lk"
              autoComplete="off"
            />
            <p className="text-muted-foreground text-sm">
              They sign in with this address, and it is how the account is
              recovered — so it has to be one only they can read.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AssignableAdminRole)}>
              <SelectTrigger id="admin-role">
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
            <p className="text-muted-foreground text-sm">{ROLE_HINTS[role]}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() =>
              mutation.mutate(undefined, {
                onSuccess: () => {
                  setOpen(false);
                  reset();
                },
              })
            }
          >
            {mutation.isPending ? "Creating…" : "Create admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
