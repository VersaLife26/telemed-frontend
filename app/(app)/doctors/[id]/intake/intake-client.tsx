"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment } from "@/lib/consumer/api/types";
import { bookingBody, bookingError, paymentPath } from "@/lib/consumer/features/booking";

export function IntakeClient({ doctorId }: { doctorId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const slotId = params.get("slot_id") || "";
  const [symptoms, setSymptoms] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const missingSlot = bookingError(slotId);
    if (missingSlot) {
      setError(missingSlot);
      return;
    }
    setLoading(true);
    try {
      const appt = await browserApi<Appointment>("/appointments", {
        method: "POST",
        body: bookingBody(slotId, doctorId, symptoms),
      });
      router.push(paymentPath(appt.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <h1 className="text-h4 text-black">Intake</h1>
        <p className="text-body-sm text-text-muted">
          Slot: {slotId || "not selected"} · Doctor: {doctorId}
        </p>
        <Input
          focused
          placeholder="Describe symptoms"
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
        />
        {error ? <p className="text-body-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? "Booking…" : "Confirm booking"}
        </Button>
      </form>
    </Card>
  );
}
