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
import type { PlatformUser } from "@/lib/admin/api/types";

const MINIMUM_REASON = 15;

/**
 * Suspend or reinstate.
 *
 * Suspending requires a reason, which the API records in the audit log.
 * Reinstating takes no body.
 */
export function SuspensionDialog({
  user,
  onClose,
}: {
  user: PlatformUser | null;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    setReason("");
    setTouched(false);
  }, [user?.id]);

  const suspending = user?.status !== "suspended";
  const tooShort = suspending && reason.trim().length < MINIMUM_REASON;

  const mutation = useApiMutation<unknown, { userId: string; suspend: boolean }>({
    method: "POST",
    path: (variables) =>
      variables.suspend
        ? endpoints.users.suspend(variables.userId)
        : endpoints.users.reinstate(variables.userId),
    body: (variables) => (variables.suspend ? { reason: reason.trim() } : undefined),
    successMessage: (_result, variables) =>
      variables.suspend ? "Account suspended." : "Account reinstated.",
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
            {suspending ? "Suspend" : "Reinstate"} {user?.fullName || "this user"}
          </DialogTitle>
          <DialogDescription>
            {suspending
              ? user?.role === "doctor"
                ? "A suspended account cannot sign in. Suspending a doctor's account also suspends their doctor profile."
                : "A suspended account cannot sign in or book. Their upcoming bookings are cancelled with a full refund."
              : "The account will be able to sign in and book again immediately."}
          </DialogDescription>
        </DialogHeader>

        {suspending ? (
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
            placeholder="e.g. Repeated no-shows after three warnings; ticket SUP-4021."
          />
          <p
            id="suspension-reason-help"
            className={
              touched && tooShort ? "text-xs text-destructive" : "text-xs text-muted-foreground"
            }
          >
            {touched && tooShort
              ? `At least ${MINIMUM_REASON} characters.`
              : "Recorded in the audit log."}
          </p>
        </div>
        ) : null}

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
              mutation.mutate({ userId: user.id, suspend: suspending });
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
