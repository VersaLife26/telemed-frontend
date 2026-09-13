import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/consumer/ui/Card";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor, Slot } from "@/lib/consumer/api/types";
import { assets } from "@/lib/consumer/assets";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { formatMoney } from "@/lib/consumer/money";
import { formatVisitClock } from "@/lib/consumer/features/patient-appointment";

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
  const openSlots = slots.filter((s) => (s.status || "").toUpperCase() === "AVAILABLE");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex w-full flex-col gap-4 lg:flex-row">
        <div className="relative mx-auto size-[280px] shrink-0 overflow-hidden rounded-[var(--radius-card)] bg-linen lg:mx-0 lg:size-[320px]">
          <Image
            src={doctor.photo_url || assets.doctorPhoto}
            alt={name}
            fill
            className="object-cover"
            unoptimized={Boolean(doctor.photo_url)}
          />
        </div>
        <Card className="flex min-w-0 flex-1 flex-col gap-5">
          <div>
            <p className="text-caption uppercase tracking-[0.14em] text-text-label">
              {doctor.specialty || "General"}
            </p>
            <h1 className="mt-2 text-h3 text-ink">{name}</h1>
          </div>
          <dl className="grid gap-3 text-body sm:grid-cols-2">
            <div>
              <dt className="text-caption text-text-label">SLMC</dt>
              <dd className="mt-1 text-ink">{doctor.slmc_number || "—"}</dd>
            </div>
            <div>
              <dt className="text-caption text-text-label">Consultations</dt>
              <dd className="mt-1 text-ink">{doctor.consultation_count ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-caption text-text-label">Fee</dt>
              <dd className="mt-1 text-ink tabular-time">{formatMoney(doctor.fee_cents, doctor.currency)}</dd>
            </div>
            <div>
              <dt className="text-caption text-text-label">Rating</dt>
              <dd className="mt-1 text-ink">
                {doctor.rating != null ? `${doctor.rating.toFixed(1)} (${doctor.review_count ?? 0})` : "—"}
              </dd>
            </div>
          </dl>
          {doctor.bio ? <p className="text-body text-text-muted">{doctor.bio}</p> : null}
        </Card>
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="text-h5 text-ink">Today’s slots</h2>
        {slotsNote ? <p className="text-body-sm text-text-muted">{slotsNote}</p> : null}
        <div className="flex flex-wrap gap-2">
          {openSlots.map((s) => (
            <Link
              key={s.id}
              href={`/doctors/${id}/intake?slot_id=${s.id}&start=${encodeURIComponent(s.start_at_local || s.start_at || "")}`}
              className="inline-flex min-h-11 min-w-20 items-center justify-center rounded-full border border-border bg-linen px-4 text-body-sm font-medium text-ink transition-colors duration-[200ms] ease-[var(--ease-out)] hover:border-primary hover:bg-primary hover:text-white"
            >
              {formatVisitClock(s.start_at_local || s.start_at) !== "—"
                ? formatVisitClock(s.start_at_local || s.start_at)
                : s.id.slice(0, 8)}
            </Link>
          ))}
          {!slotsNote && openSlots.length === 0 ? (
            <p className="text-body-sm text-text-muted">No open slots for today.</p>
          ) : null}
        </div>
        {!token ? (
          <ButtonLink href="/login" size="lg">
            Sign in to book
          </ButtonLink>
        ) : openSlots.length > 0 ? (
          <p className="text-body-sm text-text-muted">Choose a time to continue to intake.</p>
        ) : null}
      </Card>
    </div>
  );
}
