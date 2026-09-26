"use client";

import * as React from "react";
import { MessageSquare, Send } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Separator } from "@/components/admin/ui/separator";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Textarea } from "@/components/admin/ui/textarea";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation, useApiQuery } from "@/lib/admin/api/hooks";
import type { AdminAccount, Dispute, DisputeComment, DisputeDetail } from "@/lib/admin/api/types";
import { formatDateTime, formatMoney, humanise, shortId } from "@/lib/admin/format";

const MINIMUM_RESOLUTION = 25;

/**
 * One dispute: assignment, mediation thread, resolution.
 *
 * The mediation thread is internal. Nothing typed here is shown to the patient
 * or the doctor — it is the case file, and it is loaded on demand rather than
 * with the queue because forty case files is forty queries nobody asked for.
 */
export function DisputeDrawer({
  dispute,
  admins,
  onClose,
}: {
  dispute: Dispute | null;
  /** Empty when the caller may not read the admin roster; ids are then shown instead of names. */
  admins: AdminAccount[];
  onClose: () => void;
}) {
  const [comment, setComment] = React.useState("");
  const [resolution, setResolution] = React.useState("");
  const [refund, setRefund] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    setComment("");
    setResolution("");
    setRefund("");
    setTouched(false);
  }, [dispute?.id]);

  const enabled = dispute !== null;
  const detailKey = ["dispute-detail", dispute?.id ?? ""] as const;

  const detail = useApiQuery<DisputeDetail>(
    detailKey,
    dispute ? endpoints.disputes.detail(dispute.id) : "",
    { enabled },
  );

  const view = detail.data?.dispute ?? dispute;
  const adminName = (id: string | null) => {
    if (!id) return null;
    const admin = admins.find((a) => a.id === id);
    return admin ? admin.displayName || admin.email : shortId(id);
  };

  const assign = useApiMutation<DisputeDetail, { adminUserId: string | null }>({
    method: "POST",
    path: () => endpoints.disputes.assign(dispute?.id ?? ""),
    body: (variables) => ({ adminUserId: variables.adminUserId }),
    successMessage: () => "Assignment updated.",
    invalidate: [detailKey],
  });

  const addComment = useApiMutation<DisputeComment, void>({
    method: "POST",
    path: () => endpoints.disputes.comments(dispute?.id ?? ""),
    body: () => ({ body: comment.trim() }),
    successMessage: () => "Comment added to the case file.",
    invalidate: [detailKey],
    onSuccess: () => setComment(""),
  });

  const refundCents = refund.trim() === "" ? null : Math.round(Number(refund) * 100);
  const refundInvalid = refundCents !== null && (!Number.isFinite(refundCents) || refundCents <= 0);

  const resolve = useApiMutation<DisputeDetail, void>({
    method: "POST",
    path: () => endpoints.disputes.resolve(dispute?.id ?? ""),
    body: () => ({ resolution: resolution.trim(), refundAmountCents: refundCents }),
    successMessage: () =>
      refundCents === null
        ? "Dispute resolved."
        : "Dispute resolved. The refund is waiting for approval on Payments.",
    onSuccess: onClose,
  });

  const close = useApiMutation<DisputeDetail, void>({
    method: "POST",
    path: () => endpoints.disputes.close(dispute?.id ?? ""),
    successMessage: () => "Dispute closed.",
    onSuccess: onClose,
  });

  const resolutionTooShort = resolution.trim().length < MINIMUM_RESOLUTION;
  const status = view?.status;
  const settled = status === "resolved" || status === "closed";

  return (
    <Dialog open={enabled} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {view ? view.subject : "Dispute"}
            {view ? (
              <Badge className="ml-2" variant="outline">
                {humanise(view.status)}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Appointment{" "}
            <span className="font-mono">{view ? shortId(view.appointmentId) : ""}</span>
            {view ? ` · raised ${formatDateTime(view.createdAt)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {view ? (
          <div className="space-y-5">
            <section>
              <h3 className="mb-1 text-sm font-medium">What was reported</h3>
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                {view.description}
              </p>
              {detail.data && detail.data.refunds.length > 0 ? (
                <Alert variant="warning" className="mt-3">
                  <MessageSquare aria-hidden="true" />
                  <AlertTitle>Refunds from this dispute</AlertTitle>
                  <AlertDescription>
                    <ul className="space-y-0.5">
                      {detail.data.refunds.map((r) => (
                        <li key={r.id}>
                          {formatMoney(r.amountCents, r.currency)} · {humanise(r.status)}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
            </section>

            <Separator />

            <section className="space-y-2">
              <Label htmlFor="dispute-assignee">Assigned to</Label>
              <div className="flex flex-wrap gap-2">
                {admins.length > 0 ? (
                  <Select
                    value={view.assignedAdminId ?? "__unassigned__"}
                    onValueChange={(value) => {
                      if (value === "__unassigned__") return;
                      assign.mutate({ adminUserId: value });
                    }}
                    disabled={settled || assign.isPending}
                  >
                    <SelectTrigger id="dispute-assignee" className="max-w-sm">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__" disabled>
                        Unassigned
                      </SelectItem>
                      {admins
                        .filter((admin) => admin.isActive)
                        .map((admin) => (
                          <SelectItem key={admin.id} value={admin.id}>
                            {admin.displayName || admin.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p id="dispute-assignee" className="self-center text-sm">
                    {adminName(view.assignedAdminId) ?? "Unassigned"}
                  </p>
                )}
                {!settled ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={assign.isPending}
                    onClick={() => assign.mutate({ adminUserId: null })}
                  >
                    Assign to me
                  </Button>
                ) : null}
              </div>
            </section>

            <Separator />

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Internal case notes</h3>
              {detail.isPending ? (
                <div className="space-y-2" aria-busy="true">
                  <span className="sr-only">Loading case notes</span>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : detail.isError ? (
                <Alert variant="destructive">
                  <MessageSquare aria-hidden="true" />
                  <AlertTitle>Could not load case notes</AlertTitle>
                  <AlertDescription>
                    {detail.error.userMessage}
                    {detail.error.traceId ? (
                      <span className="ml-1 font-mono text-xs">
                        Trace ID: {detail.error.traceId}
                      </span>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : detail.data.comments.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No case notes yet"
                  description="Notes are internal. Neither the patient nor the doctor sees them."
                />
              ) : (
                <ol className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {detail.data.comments.map((entry) => (
                    <li key={entry.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-medium">{adminName(entry.authorAdminId)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{entry.body}</p>
                    </li>
                  ))}
                </ol>
              )}

              {status !== "closed" ? (
                <div className="flex gap-2">
                  <Textarea
                    aria-label="Add a case note"
                    rows={2}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="What you did, who you spoke to, what they said."
                  />
                  <Button
                    className="self-end"
                    disabled={comment.trim().length === 0 || addComment.isPending}
                    onClick={() => addComment.mutate()}
                  >
                    <Send className="size-4" aria-hidden="true" />
                    Add
                  </Button>
                </div>
              ) : null}
            </section>

            {!settled ? (
              <>
                <Separator />
                <section className="space-y-2">
                  <h3 className="text-sm font-medium">Resolve</h3>
                  <Label htmlFor="dispute-resolution">
                    Resolution <span aria-hidden="true">*</span>
                    <span className="sr-only">(required)</span>
                  </Label>
                  <Textarea
                    id="dispute-resolution"
                    rows={3}
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    onBlur={() => setTouched(true)}
                    aria-invalid={touched && resolutionTooShort}
                    aria-describedby="dispute-resolution-help"
                    placeholder="What was decided, and what the patient was told."
                  />
                  <p
                    id="dispute-resolution-help"
                    className={
                      touched && resolutionTooShort
                        ? "text-xs text-destructive"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {touched && resolutionTooShort
                      ? `At least ${MINIMUM_RESOLUTION} characters.`
                      : "Recorded in the audit log."}
                  </p>
                  <Label htmlFor="dispute-refund">Refund amount (LKR, optional)</Label>
                  <Input
                    id="dispute-refund"
                    inputMode="decimal"
                    className="max-w-xs"
                    value={refund}
                    onChange={(event) => setRefund(event.target.value)}
                    aria-invalid={refundInvalid}
                    aria-describedby="dispute-refund-help"
                  />
                  <p
                    id="dispute-refund-help"
                    className={refundInvalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                  >
                    {refundInvalid
                      ? "Enter a positive amount, or leave it blank."
                      : "Creates a refund request that still needs approval on the Payments screen."}
                  </p>
                  <Button
                    disabled={resolutionTooShort || refundInvalid || resolve.isPending}
                    onClick={() => {
                      setTouched(true);
                      if (resolutionTooShort || refundInvalid) return;
                      resolve.mutate();
                    }}
                  >
                    {resolve.isPending ? "Saving…" : "Record resolution"}
                  </Button>
                </section>
              </>
            ) : (
              <Alert variant="success">
                <MessageSquare aria-hidden="true" />
                <AlertTitle>{humanise(view.status)}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{view.resolution ?? "No resolution text was recorded."}</p>
                  {status === "resolved" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={close.isPending}
                      onClick={() => close.mutate()}
                    >
                      {close.isPending ? "Closing…" : "Close dispute"}
                    </Button>
                  ) : null}
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
