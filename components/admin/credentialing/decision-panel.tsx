"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Search, ShieldAlert, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
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
import type { DoctorApplication } from "@/lib/admin/api/types";
import {
  MINIMUM_REASON_LENGTH,
  allChecksPassed,
  failedItems,
  outstandingItems,
  reasonProblem,
} from "@/lib/admin/credentialing";
import { formatDateTime } from "@/lib/admin/format";

/**
 * Approve or reject.
 *
 * The rules encoded here, and why each one:
 *
 *  - **Approval requires all five checks answered yes.** Not "mostly". The
 *    button is disabled and names the outstanding items, because a disabled
 *    button that does not say why is just a broken button.
 *  - **Rejection is always available.** A reviewer who has found a forged
 *    certificate should not have to answer the other four questions first.
 *  - **A rejection requires a written reason**, with a length floor that
 *    forces a sentence. "ok" is not a credentialing record. The reason is
 *    stored on the application and sent to the applicant.
 *  - **Confirmation is a modal**, and the modal restates the doctor's name and
 *    SLMC number. Approving the wrong row in a queue of forty is a mistake
 *    somebody will make, and the last thing between them and it should be a
 *    sentence naming the person.
 */
export function DecisionPanel({ application }: { application: DoctorApplication }) {
  const id = application.id ?? "";
  const checklist = application.checklist;
  const router = useRouter();
  const [action, setAction] = React.useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const decided = application.status === "approved" || application.status === "rejected";
  const outstanding = outstandingItems(checklist);
  const failed = failedItems(checklist);
  const canApprove = allChecksPassed(checklist);
  const problem = action === "reject" ? reasonProblem(reason) : null;

  const startReview = useApiMutation<DoctorApplication, void>({
    method: "POST",
    path: () => endpoints.credentialing.startReview(id),
    successMessage: () => `Review started for ${application.displayName}.`,
  });

  const mutation = useApiMutation<DoctorApplication, { action: "approve" | "reject" }>({
    method: "POST",
    path: (variables) =>
      variables.action === "approve"
        ? endpoints.credentialing.approve(id)
        : endpoints.credentialing.reject(id),
    body: (variables) => (variables.action === "reject" ? { reason: reason.trim() } : undefined),
    successMessage: (_result, variables) =>
      variables.action === "approve"
        ? `${application.displayName} approved. They have been notified.`
        : `${application.displayName} rejected. They have been notified.`,
    onSuccess: () => {
      setAction(null);
      setReason("");
      setTouched(false);
      router.push("/doctors");
    },
  });

  if (decided) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Decision recorded</CardTitle>
          <CardDescription>This application is closed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert variant={application.status === "approved" ? "success" : "destructive"}>
            {application.status === "approved" ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <XCircle aria-hidden="true" />
            )}
            <AlertTitle>
              {application.status === "approved" ? "Approved" : "Rejected"}
              {application.decidedAt ? ` on ${formatDateTime(application.decidedAt)}` : ""}
            </AlertTitle>
            {application.status === "rejected" ? (
              <AlertDescription>
                {application.rejectionReason ?? "No reason was recorded."}
              </AlertDescription>
            ) : null}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision</CardTitle>
        <CardDescription>
          Approving creates the doctor&rsquo;s account, which is what lets them appear in
          patient search and take bookings.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {failed.length > 0 ? (
          <Alert variant="destructive">
            <ShieldAlert aria-hidden="true" />
            <AlertTitle>
              {failed.length} check{failed.length === 1 ? "" : "s"} answered no
            </AlertTitle>
            <AlertDescription>
              {failed.map((item) => item.label).join(", ")}. This registration cannot be
              approved.
            </AlertDescription>
          </Alert>
        ) : outstanding.length > 0 ? (
          <Alert variant="warning">
            <ShieldAlert aria-hidden="true" />
            <AlertTitle>
              {outstanding.length} check{outstanding.length === 1 ? "" : "s"} still
              unanswered
            </AlertTitle>
            <AlertDescription>
              {outstanding.map((item) => item.label).join(", ")}. Approval is unavailable
              until every item is answered.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="success">
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>All five checks passed</AlertTitle>
            <AlertDescription>
              This registration is ready for a decision.
            </AlertDescription>
          </Alert>
        )}

        {application.status === "pending" ? (
          <Alert variant="info">
            <Search aria-hidden="true" />
            <AlertTitle>Not yet under review</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>Start the review so colleagues can see this application is being worked on.</p>
              <Button
                size="sm"
                variant="outline"
                disabled={startReview.isPending}
                onClick={() => startReview.mutate()}
              >
                {startReview.isPending ? "Starting…" : "Start review"}
              </Button>
            </AlertDescription>
          </Alert>
        ) : application.reviewStartedAt ? (
          <p className="text-xs text-muted-foreground">
            Review started {formatDateTime(application.reviewStartedAt)}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="success"
            disabled={!canApprove}
            onClick={() => {
              mutation.reset();
              setAction("approve");
              setReason("");
              setTouched(false);
            }}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Approve
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              mutation.reset();
              setAction("reject");
              setReason("");
              setTouched(false);
            }}
          >
            <XCircle className="size-4" aria-hidden="true" />
            Reject
          </Button>
        </div>
      </CardContent>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Approve" : "Reject"} {application.displayName}
            </DialogTitle>
            <DialogDescription>
              SLMC {application.slmcNumber}
              {application.specialtyCode ? ` · ${application.specialtyCode}` : ""}.{" "}
              {action === "approve"
                ? "This doctor will become visible to patients and able to take bookings."
                : "This doctor will not be able to take bookings. They are notified, with this reason."}
            </DialogDescription>
          </DialogHeader>

          {action === "reject" ? (
          <div className="space-y-2">
            <Label htmlFor="decision-reason">
              Reason <span aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </Label>
            <Textarea
              id="decision-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => setTouched(true)}
              rows={4}
              aria-invalid={touched && problem !== null}
              aria-describedby="decision-reason-help"
              placeholder="e.g. SLMC number does not appear on the register, and the certificate image has been altered around the registration number."
            />
            <p
              id="decision-reason-help"
              className={
                touched && problem
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              {touched && problem
                ? problem
                : `Recorded permanently against this decision and sent to the applicant. At least ${MINIMUM_REASON_LENGTH} characters.`}
            </p>
          </div>
          ) : null}

          {mutation.error ? (
            <Alert variant="destructive">
              <ShieldAlert aria-hidden="true" />
              <AlertTitle>{mutation.error.userMessage}</AlertTitle>
              {mutation.error.traceId ? (
                <AlertDescription>
                  <p className="font-mono text-xs">Trace ID: {mutation.error.traceId}</p>
                </AlertDescription>
              ) : null}
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAction(null)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={action === "approve" ? "success" : "destructive"}
              disabled={problem !== null || mutation.isPending}
              onClick={() => {
                setTouched(true);
                if (problem !== null || action === null) return;
                mutation.mutate({ action });
              }}
            >
              {mutation.isPending
                ? "Submitting…"
                : action === "approve"
                  ? "Confirm approval"
                  : "Confirm rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
