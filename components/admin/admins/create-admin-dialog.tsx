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
import { ASSIGNABLE_ADMIN_ROLES, type AdminAccount, type AdminRole } from "@/lib/admin/api/types";

const ROLE_LABELS: Record<AdminRole, string> = {
  support: "Support",
  ops: "Ops",
  finance: "Finance",
  admin: "Admin",
  superAdmin: "Super admin",
};

const ROLE_HINTS: Record<AdminRole, string> = {
  support: "Patient support and disputes. Cannot move money or change settings.",
  ops: "Day-to-day operations. No finance, no admin accounts.",
  finance: "Refunds, payouts, the ledger and the audit export.",
  admin: "General administration. No finance, no admin accounts.",
  superAdmin: "Everything, including creating and re-roling admins. Grant sparingly.",
};

/**
 * Create a colleague's admin account.
 *
 * There is no password field, and that is deliberate rather than unfinished:
 * this platform has no admin passwords at all. Cloudflare Access authenticates
 * the console, so it never generates, transmits, stores or logs a credential,
 * and there is no temporary password sitting in an inbox waiting to be found.
 *
 * What this creates is the AUTHORISATION half — the admin_users row that says
 * what the person may do. The AUTHENTICATION half lives in the Access policy
 * for admin.versalifehealth.com and cannot be set from here, so a new admin
 * cannot reach the console until their address is added there. The dialog says
 * so rather than leaving a super admin to discover it from a colleague who
 * cannot sign in.
 */
export function CreateAdminDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AdminRole>("support");

  const mutation = useApiMutation<AdminAccount, void>({
    method: "POST",
    path: () => endpoints.adminUsers.create(),
    body: () => ({ email: email.trim(), displayName: displayName.trim(), role }),
    successMessage: (created) =>
      `${created.displayName || created.email} can now be given access. Add their email to the Cloudflare Access policy for the admin console — until then they cannot sign in.`,
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
            <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
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
