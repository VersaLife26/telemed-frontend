"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { browserApi } from "@/lib/consumer/api/client";
import type { RescheduleRequest } from "@/lib/consumer/api/types";

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
      <p className="text-body-sm text-text-muted">
        Waiting for patient or admin — proposed{" "}
        {pending.proposed_start_at_local || pending.proposed_start_at}
      </p>
    );
  }

  if (startAt && Number.isFinite(Date.parse(startAt)) && Date.parse(startAt) <= Date.now()) {
    return null;
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        fullWidth={false}
        className="text-body-sm"
        onClick={() => setOpen(true)}
      >
        Can’t attend — ask to reschedule
      </Button>
    );
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
      const body: { proposed_start_at: string; reason?: string } = {
        proposed_start_at: toUTCISO(when),
      };
      if (reason.trim()) body.reason = reason.trim();
      await browserApi<RescheduleRequest>(`/appointments/${appointmentId}/reschedule-requests`, {
        method: "POST",
        body,
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
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-2">
      <label className="text-body-sm text-text-muted" htmlFor={`reschedule-when-${appointmentId}`}>
        New date and time
      </label>
      <Input
        id={`reschedule-when-${appointmentId}`}
        type="datetime-local"
        required
        value={when}
        onChange={(e) => setWhen(e.target.value)}
      />
      <Textarea
        maxLength={500}
        placeholder="Reason for admin (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" fullWidth={false} disabled={saving}>
          {saving ? "Sending…" : "Send to admin"}
        </Button>
        <Button type="button" variant="outline" fullWidth={false} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
