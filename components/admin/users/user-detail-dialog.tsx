"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiQuery } from "@/lib/admin/api/hooks";
import type { PlatformUserDetail } from "@/lib/admin/api/types";
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
            {detail.data.erasureDueAt ? (
              <Row label="Erasure due" value={formatDate(detail.data.erasureDueAt)} />
            ) : null}
          </dl>
        ) : null}
      </DialogContent>
    </Dialog>
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
