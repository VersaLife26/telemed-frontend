"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/consumer/ui/Card";
import { Button, ButtonLink } from "@/components/consumer/ui/Button";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { Input } from "@/components/consumer/ui/Input";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, Doctor } from "@/lib/consumer/api/types";
import { bookingBody, bookingError, paymentPath } from "@/lib/consumer/features/booking";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";

export function IntakeClient({ doctorId }: { doctorId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const slotId = params.get("slot_id") || "";
  const start = params.get("start") || "";
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    browserApi<Doctor>(`/doctors/${doctorId}`)
      .then((d) => {
        if (!cancelled) setDoctor(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

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

  if (!slotId) {
    return (
      <EmptyState
        title="Pick a time first"
        body="Intake starts after you choose an open slot on the doctor’s page."
        action={{ href: `/doctors/${doctorId}`, label: "Choose a time" }}
      />
    );
  }

  const doctorName = doctor?.display_name || "Doctor";
  const when = start ? `${formatVisitDate(start)} · ${formatVisitClock(start)}` : "Selected slot";

  return (
    <Card className="mx-auto w-full max-w-xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <h1 className="text-h4 text-ink">Intake</h1>
          <p className="mt-2 text-body text-ink">{doctorName}</p>
          <p className="mt-1 text-body-sm text-text-muted">
            {doctor?.specialty ? `${doctor.specialty} · ` : ""}
            {when}
          </p>
        </div>
        <label htmlFor="symptoms" className="text-body-sm font-medium text-ink">
          Symptoms
        </label>
        <Input
          id="symptoms"
          focused
          placeholder="What should the doctor know?"
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
        />
        {error ? <p className="text-body-sm text-danger">{error}</p> : null}
        <Button type="submit" fullWidth busy={loading}>
          {loading ? "Booking…" : "Confirm booking"}
        </Button>
        <ButtonLink href={`/doctors/${doctorId}`} variant="outline" fullWidth>
          Change time
        </ButtonLink>
      </form>
    </Card>
  );
}
