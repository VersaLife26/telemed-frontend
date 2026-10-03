"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation, useApiQuery } from "@/lib/admin/api/hooks";
import type { AdminDoctor, PlatformUserDetail } from "@/lib/admin/api/types";
import { formatDate, humanise, shortId } from "@/lib/admin/format";

export function UserDetailDialog({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const enabled = userId !== null;
  const detail = useApiQuery<PlatformUserDetail>(
    ["user-detail", userId ?? ""],
    userId ? endpoints.users.detail(userId) : "",
    { enabled },
  );

  return (
    <Dialog open={enabled} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>User record</DialogTitle>
          <DialogDescription>
            Account details only. No clinical fields are readable here.
          </DialogDescription>
        </DialogHeader>
        {detail.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : detail.isError ? (
          <p className="text-sm text-destructive">{detail.error.userMessage}</p>
        ) : detail.data ? (
          <dl className="grid gap-2 text-sm">
            <Row label="Name" value={detail.data.fullName || "Unnamed"} />
            <Row label="User ID" value={detail.data.id} mono />
            <Row label="Role" value={humanise(detail.data.role)} />
            <Row label="Status" value={humanise(detail.data.status)} />
            {detail.data.suspendedReason ? (
              <Row label="Suspension reason" value={detail.data.suspendedReason} />
            ) : null}
            <Row label="Email" value={detail.data.email ?? "—"} />
            <Row label="Phone" value={detail.data.phoneNumber ?? "—"} />
            <Row label="Registered" value={formatDate(detail.data.createdAt)} />
            <Row label="Sri Lankan citizen" value={detail.data.isSriLankanCitizen ? "Yes" : "No"} />
            <Row label="Registration country" value={detail.data.registrationCountry ?? "—"} />
            <Row label="National ID" value={detail.data.hasNationalId ? "On file" : "Not provided"} />
            {detail.data.erasureDueAt ? (
              <Row label="Erasure due" value={formatDate(detail.data.erasureDueAt)} />
            ) : null}
          </dl>
        ) : null}
        {detail.data?.doctorId ? (
          <ForeignMultiplierForm doctorId={detail.data.doctorId} current={detail.data.foreignMultiplier} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function parseMultiplier(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 1 || value > 100) return null;
  return value;
}

function ForeignMultiplierForm({
  doctorId,
  current,
}: {
  doctorId: string;
  current: number | null;
}) {
  const [multiplier, setMultiplier] = React.useState(current == null ? "" : String(current));
  const parsed = parseMultiplier(multiplier);
  const save = useApiMutation<AdminDoctor, { multiplier: number }>({
    method: "PUT",
    path: () => endpoints.doctors.foreignMultiplier(doctorId),
    body: (variables) => variables,
    successMessage: (_result, variables) => `International multiplier set to ×${variables.multiplier}.`,
    invalidate: [["user-detail"]],
  });

  return (
    <form
      className="space-y-2 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (parsed == null) return;
        save.mutate({ multiplier: parsed });
      }}
    >
      <Label htmlFor="foreign-multiplier">International multiplier</Label>
      <p className="text-sm text-muted-foreground">
        International patients pay this multiple of the LKR fee, in USD, at the platform exchange
        rate. 4 or 5 is typical. From 1 to 100, at most 2 decimal places.
      </p>
      <Input
        id="foreign-multiplier"
        inputMode="decimal"
        value={multiplier}
        onChange={(event) => setMultiplier(event.target.value)}
        placeholder="4"
        aria-invalid={multiplier.trim() !== "" && parsed == null}
      />
      <Button type="submit" disabled={parsed == null || save.isPending}>
        {save.isPending ? "Saving…" : "Save multiplier"}
      </Button>
    </form>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : ""} title={value}>
        {mono && value.length > 12 ? shortId(value) : value}
      </dd>
    </div>
  );
}
