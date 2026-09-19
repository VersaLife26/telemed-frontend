import Image from "next/image";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";

import { Badge } from "@/components/consumer/ui/Badge";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor, Slot } from "@/lib/consumer/api/types";
import { fallbackPortrait } from "@/lib/consumer/assets";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { formatVisitClock } from "@/lib/consumer/features/patient-appointment";
import { specialtyLabel } from "@/lib/consumer/features/doctor-search";
import { profilePhotoSrc } from "@/lib/consumer/features/profile";
import { formatMoney } from "@/lib/consumer/money";

function todayColombo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-eyebrow text-faint">{label}</dt>
      <dd className="mt-1 text-body font-medium text-ink tabular-time">{value}</dd>
    </div>
  );
}

export default async function DoctorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  let doctor: Doctor | null = null;
  let slots: Slot[] = [];
  let error: string | null = null;
  let slotsNote: string | null = null;

  try {
    doctor = await apiFetch<Doctor>(`/api/v1/doctors/${id}`);
  } catch (e) {
    error = e instanceof Error ? e.message : "Doctor not found";
  }

  if (doctor && token) {
    try {
      const wrapped = await apiFetch<{ doctor_id: string; date: string; slots: Slot[] }>(
        `/api/v1/doctors/${id}/slots?date=${todayColombo()}`,
        { token },
      );
      slots = wrapped.slots || [];
    } catch (e) {
      slotsNote =
        e instanceof Error ? e.message : "Could not load today’s slots. Sign in and try again.";
    }
  } else if (doctor && !token) {
    slotsNote = "Sign in to see today’s slots and book.";
  }

  if (!doctor) {
    return (
      <EmptyState
        title="Doctor not found"
        body={error || "This profile is missing or no longer listed."}
        action={{ href: "/doctors", label: "Back to doctors" }}
      />
    );
  }

  const name = doctor.display_name || "Doctor";
  const photo = profilePhotoSrc(doctor.photo_url) ?? fallbackPortrait(doctor.id);
  const openSlots = slots.filter((s) => (s.status || "").toUpperCase() === "AVAILABLE");

  return (
    <div className="flex flex-col gap-6">
      {/* Photo and identity share one gradient plane, so the profile reads as
          a person rather than as a record with an avatar attached. */}
      <section className="overflow-hidden rounded-xl bg-[image:var(--gradient-hero)] p-5 md:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="relative mx-auto aspect-square w-56 shrink-0 overflow-hidden rounded-lg shadow-lg lg:mx-0 lg:w-72">
            <Image src={photo} alt={name} fill className="object-cover" unoptimized priority />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{specialtyLabel(doctor.specialty)}</Badge>
              {doctor.slmc_number ? (
                <Badge tone="success">
                  <BadgeCheck aria-hidden="true" className="size-3.5" />
                  SLMC {doctor.slmc_number}
                </Badge>
              ) : null}
            </div>

            <h1 className="mt-3 text-h2 text-ink">{name}</h1>

            <dl className="mt-6 grid gap-4 sm:grid-cols-3">
              <Fact label="Fee" value={formatMoney(doctor.fee_cents, doctor.currency)} />
              <Fact label="Consultations" value={doctor.consultation_count ?? "—"} />
              <Fact
                label="Rating"
                value={
                  doctor.rating != null
                    ? `${doctor.rating.toFixed(1)} (${doctor.review_count ?? 0})`
                    : "—"
                }
              />
            </dl>

            {doctor.bio ? (
              <p className="mt-6 max-w-prose text-body text-blue-900/80">{doctor.bio}</p>
            ) : null}
          </div>
        </div>
      </section>

      <Card className="flex flex-col gap-4">
        <h2 className="text-h4 text-ink">Today’s slots</h2>
        {slotsNote ? <p className="text-body-sm text-muted">{slotsNote}</p> : null}

        <div className="flex flex-wrap gap-2">
          {openSlots.map((s) => {
            const when = s.start_at_local || s.start_at;
            const clock = formatVisitClock(when);
            return (
              <Link
                key={s.id}
                href={`/doctors/${id}/intake?slot_id=${s.id}&start=${encodeURIComponent(when || "")}`}
                className="inline-flex min-h-11 min-w-20 items-center justify-center rounded-pill border border-border-default bg-surface px-4 text-label text-ink tabular-time transition-[background-color,border-color,color,transform] duration-[160ms] ease-out active:scale-[0.97] can-hover:hover:border-brand can-hover:hover:bg-brand can-hover:hover:text-on-brand"
              >
                {clock !== "—" ? clock : s.id.slice(0, 8)}
              </Link>
            );
          })}
          {!slotsNote && openSlots.length === 0 ? (
            <p className="text-body-sm text-muted">No open slots for today.</p>
          ) : null}
        </div>

        {!token ? (
          <ButtonLink href="/login" size="lg" className="self-start">
            Sign in to book
          </ButtonLink>
        ) : openSlots.length > 0 ? (
          <p className="text-body-sm text-muted">Choose a time to continue to intake.</p>
        ) : null}
      </Card>
    </div>
  );
}
