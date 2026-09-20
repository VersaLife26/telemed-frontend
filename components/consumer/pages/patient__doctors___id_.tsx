import { BadgeCheck, Star, Users, Wallet } from "lucide-react";

import { DoctorSlotPicker, type SlotDay } from "@/components/consumer/doctor-slots";
import { Badge } from "@/components/consumer/ui/Badge";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { HeroChip, PageHero } from "@/components/consumer/ui/PageHero";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor, Slot } from "@/lib/consumer/api/types";
import { fallbackPortrait } from "@/lib/consumer/assets";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { upcomingDayKeys } from "@/lib/consumer/features/calendar";
import { specialtyLabel } from "@/lib/consumer/features/doctor-search";
import { profilePhotoSrc } from "@/lib/consumer/features/profile";
import { isOpenSlot } from "@/lib/consumer/features/slots";
import { HEROES } from "@/lib/consumer/heroes";
import { formatMoney } from "@/lib/consumer/money";

const SLOT_WINDOW_DAYS = 14;

export default async function DoctorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  const dates = upcomingDayKeys(SLOT_WINDOW_DAYS);
  let doctor: Doctor | null = null;
  let days: SlotDay[] = dates.map((date) => ({ date, slots: [] }));
  let error: string | null = null;
  let slotsNote: string | null = null;

  try {
    doctor = await apiFetch<Doctor>(`/api/v1/doctors/${id}`);
  } catch (e) {
    error = e instanceof Error ? e.message : "Doctor not found";
  }

  if (doctor && token) {
    const loaded = await Promise.all(
      dates.map(async (date) => {
        try {
          const wrapped = await apiFetch<{ slots?: Slot[] }>(
            `/api/v1/doctors/${id}/slots?date=${date}`,
            { token },
          );
          return { date, slots: (wrapped.slots || []).filter(isOpenSlot), ok: true as const };
        } catch (e) {
          return {
            date,
            slots: [] as Slot[],
            ok: false as const,
            error: e instanceof Error ? e.message : "Could not load slots.",
          };
        }
      }),
    );
    days = loaded.map(({ date, slots }) => ({ date, slots }));
    if (loaded.every((day) => !day.ok)) {
      slotsNote = loaded[0]?.error || "Could not load slots. Sign in and try again.";
    }
  } else if (doctor && !token) {
    slotsNote = "Sign in to see available slots and book.";
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

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        {...HEROES.doctorDetail}
        eyebrow={specialtyLabel(doctor.specialty)}
        title={name}
        lede={doctor.bio ?? undefined}
        image={photo}
        imageAlt={name}
        framed
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
              <h2 className="text-h4 text-ink">Available slots</h2>
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

            {token && !slotsNote ? (
              <DoctorSlotPicker doctorId={id} today={dates[0] ?? ""} days={days} />
            ) : null}
            {!token ? (
              <ButtonLink href="/login" size="lg" className="self-start">
                Sign in to book
              </ButtonLink>
            ) : null}
          </Card>
        }
      />
    </div>
  );
}
