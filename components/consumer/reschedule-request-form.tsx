"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { Modal } from "@/components/consumer/ui/Modal";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { browserApi } from "@/lib/consumer/api/client";
import type { RescheduleRequest } from "@/lib/consumer/api/types";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";

function toUTCISO(local: string): string {
  return new Date(local).toISOString();
}

export function RescheduleRequestForm({
  appointmentId,
  pending,
  startAt,
}: {
  appointmentId: string;
  pending: RescheduleRequest | null;
  startAt?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (pending) {
    return (
      <p className="text-body-sm text-muted">
        Waiting for patient or admin — proposed{" "}
        {formatVisitDate(pending.proposedStartAt)} {formatVisitClock(pending.proposedStartAt)}
      </p>
    );
  }

  if (startAt && Number.isFinite(Date.parse(startAt)) && Date.parse(startAt) <= Date.now()) {
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!when) {
      setError("Pick a new date and time");
      return;
    }
    setSaving(true);
    try {
      await browserApi<RescheduleRequest>(`/appointments/${appointmentId}/reschedule-requests`, {
        method: "POST",
        body: { proposedStartAt: toUTCISO(when), reason: reason.trim() || null },
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Can’t attend — ask to reschedule
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ask to reschedule"
        description="An administrator reviews the request before the patient sees it."
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input
            id={`reschedule-when-${appointmentId}`}
            label="New date and time"
            type="datetime-local"
            required
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
          <Textarea
            id={`reschedule-reason-${appointmentId}`}
            label="Reason"
            hint="Optional. Seen by the administrator reviewing this."
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" busy={saving}>
              Send to admin
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
