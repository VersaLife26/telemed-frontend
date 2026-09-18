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
import { useApiList, useApiMutation, useApiQuery } from "@/lib/admin/api/hooks";
import type { AdminIdentity, Dispute, DisputeComment } from "@/lib/admin/api/types";
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
  admins: AdminIdentity[];
  onClose: () => void;
}) {
  const [comment, setComment] = React.useState("");
  const [resolution, setResolution] = React.useState("");
  const [outcome, setOutcome] = React.useState<"resolved" | "closed">("resolved");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    setComment("");
    setResolution(dispute?.resolution ?? "");
    setTouched(false);
  }, [dispute?.id, dispute?.resolution]);

  const enabled = dispute !== null;

  const comments = useApiList<DisputeComment>(
    ["dispute-comments", dispute?.id ?? ""],
    dispute ? endpoints.disputes.comments(dispute.id) : "",
    { enabled },
  );

  const detail = useApiQuery<Dispute>(
    ["dispute-detail", dispute?.id ?? ""],
    dispute ? endpoints.disputes.detail(dispute.id) : "",
    { enabled },
  );

  const view = detail.data ?? dispute;

  const assign = useApiMutation<Dispute, { assignedTo: string | null }>({
    method: "POST",
    path: () => endpoints.disputes.assign(dispute?.id ?? ""),
            body: (variables) => ({
      assigned_to: variables.assignedTo,
      version: (detail.data ?? dispute)?.version,
    }),
    successMessage: () => "Assignment updated.",
  });

  const addComment = useApiMutation<DisputeComment, void>(
    {
      method: "POST",
      path: () => endpoints.disputes.comments(dispute?.id ?? ""),
      body: () => ({ body: comment.trim() }),
      successMessage: () => "Comment added to the case file.",
      invalidate: [["dispute-comments", dispute?.id ?? ""]],
      onSuccess: () => setComment(""),
    },
  );

  const resolve = useApiMutation<Dispute, void>({
    method: "POST",
    path: () => endpoints.disputes.resolve(dispute?.id ?? ""),
    body: () => ({
      status: outcome,
      resolution: resolution.trim(),
      version: (detail.data ?? dispute)?.version,
    }),
    successMessage: () => "Dispute resolved.",
    onSuccess: onClose,
  });

  const resolutionTooShort = resolution.trim().length < MINIMUM_RESOLUTION;
  const settled = dispute?.status === "resolved" || dispute?.status === "closed";

  return (
    <Dialog open={enabled} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {dispute ? humanise(dispute.category) : "Dispute"}
            {dispute ? (
              <Badge className="ml-2" variant="outline">
                {humanise(dispute.status)}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Appointment{" "}
            <span className="font-mono">{dispute ? shortId(dispute.appointment_id) : ""}</span>
            {dispute ? ` · raised ${formatDateTime(dispute.created_at)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {dispute ? (
          <div className="space-y-5">
            <section>
              <h3 className="mb-1 text-sm font-medium">What the patient reported</h3>
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                {view?.description || "Open the case to load the patient's report."}
              </p>
              {view?.refund_requested ? (
                <Alert variant="warning" className="mt-3">
                  <MessageSquare aria-hidden="true" />
                  <AlertTitle>
                    Refund requested:{" "}
                    {formatMoney(view.refund_amount_cents, view.currency)}
                  </AlertTitle>
                  <AlertDescription>
                    Resolving this dispute does not move money. Approve the refund on the
                    Payments screen — that is what publishes admin.refund_approved.
                  </AlertDescription>
                </Alert>
              ) : null}
            </section>

            <Separator />

            <section className="space-y-2">
              <Label htmlFor="dispute-assignee">Assigned to</Label>
              <div className="flex gap-2">
                <Select
                  value={dispute.assigned_to ?? "__unassigned__"}
                  onValueChange={(value) => {
                    if (value === "__unassigned__") return;
                    assign.mutate({ assignedTo: value });
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
                    {admins.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.display_name || admin.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <Separator />

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Internal case notes</h3>
              {comments.isPending ? (
                <div className="space-y-2" aria-busy="true">
                  <span className="sr-only">Loading case notes</span>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : comments.isError ? (
                <Alert variant="destructive">
                  <MessageSquare aria-hidden="true" />
                  <AlertTitle>Could not load case notes</AlertTitle>
                  <AlertDescription>
                    {comments.error.userMessage}
                    {comments.error.requestId ? (
                      <span className="ml-1 font-mono text-xs">
                        Request ID: {comments.error.requestId}
                      </span>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : comments.data.data.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No case notes yet"
                  description="Notes are internal. Neither the patient nor the doctor sees them."
                />
              ) : (
                <ol className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {comments.data.data.map((entry) => (
                    <li key={entry.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-medium">{entry.author_name ?? "Admin"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(entry.created_at)}
                        </p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{entry.body}</p>
                    </li>
                  ))}
                </ol>
              )}

              {!settled ? (
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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={outcome === "resolved" ? "default" : "outline"}
                      size="sm"
                      aria-pressed={outcome === "resolved"}
                      onClick={() => setOutcome("resolved")}
                    >
                      Resolved
                    </Button>
                    <Button
                      variant={outcome === "closed" ? "default" : "outline"}
                      size="sm"
                      aria-pressed={outcome === "closed"}
                      onClick={() => setOutcome("closed")}
                    >
                      Closed without action
                    </Button>
                  </div>
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
                      : "Shown to the patient and recorded in the audit log."}
                  </p>
                  <Button
                    disabled={resolutionTooShort || resolve.isPending}
                    onClick={() => {
                      setTouched(true);
                      if (resolutionTooShort) return;
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
                <AlertTitle>{humanise(dispute.status)}</AlertTitle>
                <AlertDescription>
                  {dispute.resolution ?? "No resolution text was recorded."}
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
