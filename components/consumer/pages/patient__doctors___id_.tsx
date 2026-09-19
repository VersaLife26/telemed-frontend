import Link from "next/link";
import { BadgeCheck, Star, Users, Wallet } from "lucide-react";

import { Badge } from "@/components/consumer/ui/Badge";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { HeroChip, PageHero } from "@/components/consumer/ui/PageHero";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor, Slot } from "@/lib/consumer/api/types";
import { fallbackPortrait } from "@/lib/consumer/assets";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { formatVisitClock } from "@/lib/consumer/features/patient-appointment";
import { specialtyLabel } from "@/lib/consumer/features/doctor-search";
import { profilePhotoSrc } from "@/lib/consumer/features/profile";
import { HEROES } from "@/lib/consumer/heroes";
import { formatMoney } from "@/lib/consumer/money";

function todayColombo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
      <PageHero
        {...HEROES.doctorDetail}
        eyebrow={specialtyLabel(doctor.specialty)}
        title={name}
        lede={doctor.bio ?? undefined}
        image={photo}
        imageAlt={name}
        chips={
          <>
            <HeroChip
              icon={<Wallet className="size-5" />}
              value={formatMoney(doctor.fee_cents, doctor.currency)}
              label="Consultation fee"
            />
            <HeroChip
              icon={<Star className="size-5" />}
              value={doctor.rating != null ? doctor.rating.toFixed(1) : "—"}
              label={`${doctor.review_count ?? 0} reviews`}
              className="ml-10"
            />
            <HeroChip
              icon={<Users className="size-5" />}
              value={doctor.consultation_count ?? "—"}
              label="Consultations"
            />
          </>
        }
        overlap={
          <Card className="flex flex-col gap-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-h4 text-ink">Today’s slots</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{specialtyLabel(doctor.specialty)}</Badge>
                {doctor.slmc_number ? (
                  <Badge tone="success">
                    <BadgeCheck aria-hidden="true" className="size-3.5" />
                    SLMC {doctor.slmc_number}
                  </Badge>
                ) : null}
              </div>
            </div>
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
        }
      />
    </div>
  );
}
