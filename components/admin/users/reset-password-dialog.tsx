"use client";

import * as React from "react";
import { Check, Copy, KeyRound, Sparkles } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { PlatformUser } from "@/lib/admin/api/types";

const MINIMUM_PASSWORD_LENGTH = 8;

function generateSecurePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
  const array = new Uint8Array(14);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

export function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: PlatformUser | null;
  onClose: () => void;
}) {
  const [password, setPassword] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setPassword("");
    setTouched(false);
    setCopied(false);
  }, [user?.id]);

  const tooShort = password.length < MINIMUM_PASSWORD_LENGTH;

  const mutation = useApiMutation<unknown, { userId: string; newPassword: string }>({
    method: "POST",
    path: (variables) => endpoints.users.resetPassword(variables.userId),
    body: (variables) => ({ newPassword: variables.newPassword }),
    successMessage: () =>
      "Password has been successfully reset. Active user sessions were revoked.",
    onSuccess: onClose,
  });

  const handleGenerate = () => {
    const generated = generateSecurePassword();
    setPassword(generated);
    setTouched(true);
  };

  const handleCopy = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" aria-hidden="true" />
            Reset password for {user?.fullName || "user"}
          </DialogTitle>
          <DialogDescription>
            Setting a new password will immediately revoke all active sessions for this account.
            The user must log in using the new password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="new-password">
                New password <span aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                onClick={handleGenerate}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                Generate random
              </Button>
            </div>
            <div className="relative">
              <Input
                id="new-password"
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && tooShort}
                placeholder="At least 8 characters"
                className="pr-10 font-mono text-sm"
              />
              {password ? (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Copy password"
                  aria-label="Copy password to clipboard"
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                </button>
              ) : null}
            </div>
            {touched && tooShort ? (
              <p className="text-xs text-destructive">
                Password must be at least {MINIMUM_PASSWORD_LENGTH} characters.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Copy and securely share this password with the user after resetting.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={tooShort || mutation.isPending}
            onClick={() => {
              if (user) {
                mutation.mutate({ userId: user.id, newPassword: password });
              }
            }}
          >
            {mutation.isPending ? "Resetting password…" : "Reset password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
