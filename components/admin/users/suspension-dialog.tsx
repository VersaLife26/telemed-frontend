"use client";

import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { AdminUserRecord } from "@/lib/admin/api/types";

const MINIMUM_REASON = 15;

/**
 * Suspend or reinstate.
 *
 * Both directions require a reason. Reinstating without one is how a suspension
 * gets quietly undone and nobody can later say why — and this console publishes
 * `admin.user_suspend_requested` / `admin.user_reinstate_requested` to
 * user-service, so the reason travels with the command rather than being an
 * afterthought in a ticket.
 */
export function SuspensionDialog({
  user,
  onClose,
}: {
  user: AdminUserRecord | null;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    setReason("");
    setTouched(false);
  }, [user?.user_id]);

  const suspending = user?.status !== "suspended";
  const tooShort = reason.trim().length < MINIMUM_REASON;

  const mutation = useApiMutation<unknown, { userId: string; suspend: boolean }>({
    method: "POST",
    path: (variables) =>
      variables.suspend
        ? endpoints.users.suspend(variables.userId)
        : endpoints.users.reinstate(variables.userId),
    body: () => ({ reason: reason.trim() }),
    successMessage: (_result, variables) =>
      variables.suspend
        ? "Suspension requested. user-service applies it and publishes user.suspended."
        : "Reinstatement requested. user-service applies it and publishes user.reinstated.",
    onSuccess: onClose,
  });

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {suspending ? "Suspend" : "Reinstate"} {user?.full_name ?? "this user"}
          </DialogTitle>
          <DialogDescription>
            {suspending
              ? "A suspended account cannot sign in or book. Any confirmed appointments are left alone — cancel those separately if that is what you mean to do."
              : "The account will be able to sign in and book again immediately."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="suspension-reason">
            Reason <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </Label>
          <Textarea
            id="suspension-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && tooShort}
            aria-describedby="suspension-reason-help"
            placeholder={
              suspending
                ? "e.g. Repeated no-shows after three warnings; ticket SUP-4021."
                : "e.g. Payment dispute resolved in the patient's favour; ticket SUP-4021."
            }
          />
          <p
            id="suspension-reason-help"
            className={
              touched && tooShort ? "text-xs text-destructive" : "text-xs text-muted-foreground"
            }
          >
            {touched && tooShort
              ? `At least ${MINIMUM_REASON} characters.`
              : "Recorded in the audit log and sent with the command to user-service."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant={suspending ? "destructive" : "default"}
            disabled={tooShort || mutation.isPending || !user}
            onClick={() => {
              setTouched(true);
              if (tooShort || !user) return;
              mutation.mutate({ userId: user.user_id, suspend: suspending });
            }}
          >
            {mutation.isPending
              ? "Submitting…"
              : suspending
                ? "Suspend account"
                : "Reinstate account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
