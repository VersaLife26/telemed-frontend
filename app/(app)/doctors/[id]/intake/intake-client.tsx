"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowRight, CalendarClock, CalendarDays, Clock, Stethoscope, UserRound } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button, ButtonLink } from "@/components/consumer/ui/Button";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { Input } from "@/components/consumer/ui/Input";
import { PageHero } from "@/components/consumer/ui/PageHero";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, Doctor } from "@/lib/consumer/api/types";
import { bookingBody, bookingError, paymentPath } from "@/lib/consumer/features/booking";
import { specialtyLabel } from "@/lib/consumer/features/doctor-search";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";
import { HEROES } from "@/lib/consumer/heroes";

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

  return (
    <div className="flex flex-col gap-10">
      <PageHero {...HEROES.booking} />

      {/* The kit's "Book an Appointment" card: a clinician on the left, the
          form on the right. What is being booked is restated as read-only
          fields -- committing to a time and a fee from memory is how people
          end up on the wrong slot. */}
      <section className="overflow-hidden rounded-xl border border-blue-100 bg-[image:var(--gradient-hero)] shadow-md">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
          <div className="relative hidden min-h-[440px] lg:block">
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-1/2 size-[340px] -translate-x-1/2 translate-y-1/4 rounded-full bg-white/50 blur-2xl"
            />
            <Image
              src={HEROES.booking.image}
              alt=""
              fill
              sizes="420px"
              unoptimized
              className="object-contain object-bottom pt-8"
            />
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5 p-6 md:p-8 lg:py-10 lg:pr-10">
            <div>
              <p className="text-eyebrow text-brand">Book an</p>
              <h2 className="mt-1 text-h2 text-ink">Appointment</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="intake-doctor"
                label="Doctor"
                value={doctorName}
                readOnly
                icon={<UserRound className="size-4" />}
              />
              <Input
                id="intake-specialty"
                label="Specialty"
                value={doctor?.specialty ? specialtyLabel(doctor.specialty) : "—"}
                readOnly
                icon={<Stethoscope className="size-4" />}
              />
              <Input
                id="intake-date"
                label="Date"
                value={start ? formatVisitDate(start) : "Selected slot"}
                readOnly
                icon={<CalendarDays className="size-4" />}
                className="tabular-time"
              />
              <Input
                id="intake-time"
                label="Time"
                value={start ? formatVisitClock(start) : "—"}
                readOnly
                icon={<Clock className="size-4" />}
                className="tabular-time"
              />
            </div>

            <Textarea
              id="symptoms"
              label="Symptoms"
              hint="A sentence or two is enough — the doctor will ask the rest on the call."
              placeholder="What should the doctor know?"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            />

            {error ? <Alert tone="danger" title="Booking failed">{error}</Alert> : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" busy={loading}>
                {loading ? "Booking…" : "Confirm booking"}
                {loading ? null : <ArrowRight aria-hidden="true" className="size-4" />}
              </Button>
              <ButtonLink href={`/doctors/${doctorId}`} variant="ghost">
                Change time
              </ButtonLink>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
