"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";

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
import type { PendingDoctor, VerificationChecklist } from "@/lib/admin/api/types";
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
 *  - **Both decisions require a written reason**, with a length floor that
 *    forces a sentence. "ok" is not a credentialing record. The reason is
 *    stored on `verification_checklists.decision_reason` and copied into the
 *    audit log and the notification the doctor receives.
 *  - **Confirmation is a modal**, and the modal restates the doctor's name and
 *    SLMC number. Approving the wrong row in a queue of forty is a mistake
 *    somebody will make, and the last thing between them and it should be a
 *    sentence naming the person.
 */
export function DecisionPanel({
  doctor,
  checklist,
}: {
  doctor: PendingDoctor;
  checklist: VerificationChecklist;
}) {
  const router = useRouter();
  const [action, setAction] = React.useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const decided = checklist.overall_status !== "pending";
  const outstanding = outstandingItems(checklist);
  const failed = failedItems(checklist);
  const canApprove = allChecksPassed(checklist);
  const problem = reasonProblem(reason);

  const mutation = useApiMutation<VerificationChecklist, { action: "approve" | "reject" }>({
    method: "POST",
    path: () => endpoints.credentialing.verify(doctor.doctor_id),
    body: (variables) => ({
      action: variables.action,
      reason: reason.trim(),
      version: checklist.version,
    }),
    successMessage: (_result, variables) =>
      variables.action === "approve"
        ? `${doctor.full_name} approved. doctor.approved has been queued.`
        : `${doctor.full_name} rejected. doctor.rejected has been queued.`,
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
          <CardDescription>
            This checklist is closed. Re-verification opens a new checklist rather than
            reopening this one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert variant={checklist.overall_status === "approved" ? "success" : "destructive"}>
            {checklist.overall_status === "approved" ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <XCircle aria-hidden="true" />
            )}
            <AlertTitle>
              {checklist.overall_status === "approved" ? "Approved" : "Rejected"}
              {checklist.decided_at ? ` on ${formatDateTime(checklist.decided_at)}` : ""}
            </AlertTitle>
            <AlertDescription>
              {checklist.decision_reason ?? "No reason was recorded."}
            </AlertDescription>
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
          Approving publishes <code className="text-xs">doctor.approved</code>, which is
          what lets this doctor appear in patient search and take bookings.
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

        <div className="flex flex-wrap gap-2">
          <Button
            variant="success"
            disabled={!canApprove}
            onClick={() => {
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
              {action === "approve" ? "Approve" : "Reject"} {doctor.full_name}
            </DialogTitle>
            <DialogDescription>
              SLMC {doctor.slmc_number}
              {doctor.specialty_code ? ` · ${doctor.specialty_code}` : ""}.{" "}
              {action === "approve"
                ? "This doctor will become visible to patients and able to take bookings."
                : "This doctor will not be able to take bookings. They are notified, with this reason."}
            </DialogDescription>
          </DialogHeader>

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
              placeholder={
                action === "approve"
                  ? "e.g. SLMC 41235 confirmed on the register on 20 Aug, NIC and certificate names match, 9 years post-registration."
                  : "e.g. SLMC number does not appear on the register, and the certificate image has been altered around the registration number."
              }
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
                : `Recorded permanently against this decision and included in the audit log. At least ${MINIMUM_REASON_LENGTH} characters.`}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAction(null)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
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
