"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Avatar } from "@/components/consumer/ui/Avatar";
import { Button, ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, Doctor } from "@/lib/consumer/api/types";
import { bookingBody, bookingError, paymentPath } from "@/lib/consumer/features/booking";
import { specialtyLabel } from "@/lib/consumer/features/doctor-search";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";
import { profilePhotoSrc } from "@/lib/consumer/features/profile";

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
        icon={<CalendarClock className="size-5" />}
        action={{ href: `/doctors/${doctorId}`, label: "Choose a time" }}
      />
    );
  }

  const doctorName = doctor?.display_name || "Doctor";
  const when = start ? `${formatVisitDate(start)} · ${formatVisitClock(start)}` : "Selected slot";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <h1 className="text-h2 text-ink">Intake</h1>

      {/* What is being booked, restated above the form. Committing to a time
          and a fee from memory is how people end up on the wrong slot. */}
      <Card variant="tint" className="flex items-center gap-4 p-5">
        <Avatar src={profilePhotoSrc(doctor?.photo_url)} name={doctorName} size={48} />
        <div className="min-w-0">
          <p className="truncate text-h5 text-ink">{doctorName}</p>
          <p className="mt-0.5 truncate text-body-sm text-muted tabular-time">
            {doctor?.specialty ? `${specialtyLabel(doctor.specialty)} · ` : ""}
            {when}
          </p>
        </div>
      </Card>

      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Textarea
            id="symptoms"
            label="Symptoms"
            hint="A sentence or two is enough — the doctor will ask the rest on the call."
            placeholder="What should the doctor know?"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
          />

          {error ? <Alert tone="danger" title="Booking failed">{error}</Alert> : null}

          <div className="flex flex-col gap-3">
            <Button type="submit" size="lg" fullWidth busy={loading}>
              {loading ? "Booking…" : "Confirm booking"}
            </Button>
            <ButtonLink href={`/doctors/${doctorId}`} variant="ghost" fullWidth>
              Change time
            </ButtonLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
