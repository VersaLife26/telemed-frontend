import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/consumer/layout/AppShell";
import { ProfileField, ProfileFieldRow } from "@/components/consumer/profile/ProfileField";
import { Button } from "@/components/consumer/ui/Button";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor, Slot } from "@/lib/consumer/api/types";
import { assets } from "@/lib/consumer/assets";
import { getAccessToken } from "@/lib/consumer/auth/cookies";

function feeLabel(cents?: number, currency = "LKR") {
  if (cents == null) return "—";
  return `${currency} ${(cents / 100).toLocaleString()}`;
}

function todayColombo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function DoctorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
      const wrapped = await apiFetch<{
        doctor_id: string;
        date: string;
        slots: Slot[];
      }>(`/api/v1/doctors/${id}/slots?date=${todayColombo()}`, { token });
      slots = wrapped.slots || [];
    } catch (e) {
      slotsNote =
        e instanceof Error
          ? e.message
          : "Could not load slots (login required at gateway).";
    }
  } else if (doctor && !token) {
    slotsNote = "Sign in to load today's available slots and book.";
  }

  if (!doctor) {
    return <p className="text-body text-danger">{error || "Doctor not found"}</p>;
  }

  const name = doctor.display_name || "Doctor";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex w-full flex-col gap-4 lg:flex-row">
        <div className="relative mx-auto size-[280px] shrink-0 overflow-hidden rounded-[var(--radius-card)] lg:mx-0 lg:size-[320px]">
          <Image
            src={doctor.photo_url || assets.doctorPhoto}
            alt={name}
            fill
            className="object-cover"
            unoptimized={Boolean(doctor.photo_url)}
          />
        </div>
        <Card className="flex min-w-0 flex-1 flex-col gap-6">
          <h2 className="px-2 text-h4 text-black">{name}</h2>
          <ProfileFieldRow>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <ProfileField
                label="Specialization :"
                value={doctor.specialty || "—"}
                labelWidth="w-[149px]"
              />
              <ProfileField
                label="SLMC Register No :"
                value={doctor.slmc_number || "—"}
                labelWidth="w-auto min-w-[157px]"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <ProfileField
                label="Consultations :"
                value={String(doctor.consultation_count ?? "—")}
                labelWidth="w-auto"
              />
              <ProfileField
                label="Fee :"
                value={feeLabel(doctor.fee_cents, doctor.currency)}
                labelWidth="w-[189px]"
              />
            </div>
          </ProfileFieldRow>
          <div className="flex min-h-[80px] gap-4">
            <div className="flex w-[149px] shrink-0 items-start p-2">
              <span className="text-body text-black">Bio :</span>
            </div>
            <div className="min-h-[80px] flex-1 rounded-[var(--radius-input)] bg-white p-2">
              <span className="text-body text-text-label">{doctor.bio || "—"}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-4">
        <h3 className="text-h5 text-black">Today&apos;s slots ({todayColombo()})</h3>
        {slotsNote ? <p className="text-body-sm text-text-muted">{slotsNote}</p> : null}
        <div className="flex flex-wrap gap-2">
          {slots
            .filter((s) => (s.status || "").toUpperCase() === "AVAILABLE")
            .map((s) => (
              <Link
                key={s.id}
                href={`/doctors/${id}/intake?slot_id=${s.id}`}
                className="rounded-full border border-border bg-white px-4 py-2 text-body-sm hover:bg-primary hover:text-white"
              >
                {(s.start_at_local || s.start_at || "").slice(11, 16) || s.id.slice(0, 8)}
              </Link>
            ))}
          {!slotsNote && slots.length === 0 ? (
            <p className="text-body-sm text-text-muted">No open slots for today.</p>
          ) : null}
        </div>
        <Link href={`/doctors/${id}/intake`} className="max-w-sm">
          <Button size="lg" className="!font-medium">
            Book appointment
          </Button>
        </Link>
      </Card>
    </div>
  );
}
