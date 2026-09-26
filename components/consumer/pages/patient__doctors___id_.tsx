import { BriefcaseMedical, Wallet } from "lucide-react";

import { DoctorSlotPicker } from "@/components/consumer/doctor-slots";
import { Badge } from "@/components/consumer/ui/Badge";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { HeroChip, PageHero } from "@/components/consumer/ui/PageHero";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor, Slots, Specialty } from "@/lib/consumer/api/types";
import { fallbackPortrait } from "@/lib/consumer/assets";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { upcomingDayKeys } from "@/lib/consumer/features/calendar";
import { specialtyLabel } from "@/lib/consumer/features/doctor-search";
import { profilePhotoSrc } from "@/lib/consumer/features/profile";
import { slotsByDay, slotsPath, type SlotDay } from "@/lib/consumer/features/slots";
import { HEROES } from "@/lib/consumer/heroes";
import { formatMoney } from "@/lib/consumer/money";

const SLOT_WINDOW_DAYS = 14;

export default async function DoctorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  const dates = upcomingDayKeys(SLOT_WINDOW_DAYS);
  const from = dates[0] ?? "";
  const to = dates[dates.length - 1] ?? from;

  const [doctorResult, slotsResult, specialties] = await Promise.all([
    apiFetch<Doctor>(`/api/v1/doctors/${id}`).then(
      (doctor) => ({ doctor, error: null }),
      (e: unknown) => ({ doctor: null, error: e instanceof Error ? e.message : "Doctor not found" }),
    ),
    token
      ? apiFetch<Slots>(`/api/v1${slotsPath(id, from, to)}`).then(
          (slots) => ({ slots, error: null }),
          (e: unknown) => ({ slots: null, error: e instanceof Error ? e.message : "Could not load slots." }),
        )
      : { slots: null, error: null },
    apiFetch<Specialty[]>("/api/v1/specialties").catch(() => [] as Specialty[]),
  ]);
  const { doctor } = doctorResult;

  if (!doctor) {
    return (
      <EmptyState
        title="Doctor not found"
        body={doctorResult.error || "This profile is missing or no longer listed."}
        action={{ href: "/doctors", label: "Back to doctors" }}
      />
    );
  }

  const timeZone = slotsResult.slots?.timezone;
  const days: SlotDay[] = slotsResult.slots
    ? slotsByDay(dates, slotsResult.slots.slots, slotsResult.slots.timezone)
    : [];
  const name = doctor.displayName || "Doctor";
  const photo = profilePhotoSrc(doctor.photoUrl) ?? fallbackPortrait(doctor.id ?? id);
  const specialty = specialtyLabel(doctor.specialtyCode, specialties);

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        {...HEROES.doctorDetail}
        eyebrow={specialty}
        title={name}
        lede={doctor.bio || undefined}
        image={photo}
        imageAlt={name}
        framed
        chips={
          <>
            <HeroChip
              icon={<Wallet className="size-5" />}
              value={formatMoney(doctor.feeCents, doctor.currency)}
              label="Consultation fee"
            />
            {doctor.experienceYears ? (
              <HeroChip
                icon={<BriefcaseMedical className="size-5" />}
                value={`${doctor.experienceYears} yrs`}
                label="Experience"
                className="ml-10"
              />
            ) : null}
          </>
        }
        overlap={
          <Card className="flex flex-col gap-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-h4 text-ink">Available slots</h2>
              <Badge tone="brand">{specialty}</Badge>
            </div>
            {slotsResult.error ? <p className="text-body-sm text-muted">{slotsResult.error}</p> : null}

            {token && timeZone ? (
              <DoctorSlotPicker doctorId={id} today={from} days={days} timeZone={timeZone} />
            ) : null}
            {!token ? (
              <>
                <p className="text-body-sm text-muted">Sign in to see available slots and book.</p>
                <ButtonLink href="/login" size="lg" className="self-start">
                  Sign in to book
                </ButtonLink>
              </>
            ) : null}
          </Card>
        }
      />
    </div>
  );
}
