import Link from "next/link";
import { BadgeCheck, CalendarClock, ListOrdered, Stethoscope, Wallet } from "lucide-react";

import { PracticeOverview } from "@/components/consumer/practice-overview";
import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { apiFetch } from "@/lib/consumer/api/client";
import type { DoctorAnalytics, DoctorProfile, PeakHour, Specialty } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { specialtyLabel } from "@/lib/consumer/features/doctor-search";
import { apiFileSrc } from "@/lib/consumer/features/practice";
import { HeroChip, PageHero } from "@/components/consumer/ui/PageHero";
import { assets } from "@/lib/consumer/assets";
import { HEROES } from "@/lib/consumer/heroes";

const SHORTCUTS = [
  { href: "/queue", label: "Queue", hint: "Today’s appointments", Icon: ListOrdered },
  { href: "/availability", label: "Availability", hint: "Working hours", Icon: CalendarClock },
  { href: "/earnings", label: "Earnings", hint: "Settled consults", Icon: Wallet },
] as const;

export default async function DashboardPage() {
  const token = await getAccessToken();
  if (!token) {
    return (
      <Card className="flex max-w-xl flex-col items-start gap-4">
        <p className="text-body text-muted">
          Sign in to load your practice dashboard.
        </p>
        <ButtonLink href="/login">Sign in</ButtonLink>
      </Card>
    );
  }

  let me: DoctorProfile | null = null;
  let error: string | null = null;
  try {
    me = await apiFetch<DoctorProfile>("/api/v1/doctors/me", { token });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load";
  }

  if (error || !me) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <Alert tone="danger" title="No doctor profile">
          {error || "This session has no doctor profile attached."}
        </Alert>
        <p className="text-body-sm text-muted">
          If the OTP succeeded as a patient account, register or approve a doctor profile first.
          Pending credentialing shows on Verification.
        </p>
        <ButtonLink href="/verification-pending" variant="outline" className="self-start">
          Verification status
        </ButtonLink>
      </div>
    );
  }

  if (me.status === "suspended") {
    return (
      <Card variant="tint" className="flex max-w-xl flex-col items-start gap-4">
        <Badge tone="warning">Suspended</Badge>
        <h1 className="text-h3 text-ink">Your practice is suspended</h1>
        <p className="text-body text-muted">
          {me.suspendedReason || "Patients cannot book you until the admin team reinstates your profile."}
        </p>
      </Card>
    );
  }

  const specialties = await apiFetch<Specialty[]>("/api/v1/specialties").catch(() => [] as Specialty[]);

  let summary: DoctorAnalytics | null = null;
  let peak: PeakHour[] | null = null;
  let analyticsError: string | null = null;
  try {
    const [s, p] = await Promise.all([
      apiFetch<DoctorAnalytics>("/api/v1/doctors/me/analytics", { token }),
      apiFetch<PeakHour[]>("/api/v1/doctors/me/analytics/peak-hours", { token }),
    ]);
    summary = s;
    peak = p;
  } catch (e) {
    analyticsError = e instanceof Error ? e.message : "Could not load practice analytics";
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHero
        {...HEROES.dashboard}
        title={me.displayName || "Doctor"}
        image={apiFileSrc(me.photoUrl) ?? assets.avatarPlaceholder}
        imageAlt={me.displayName || "Your profile photo"}
        framed
        chips={
          <>
            <HeroChip
              icon={<Stethoscope className="size-5" />}
              value={me.specialtyCode ? specialtyLabel(me.specialtyCode, specialties) : "Specialty"}
              label="Specialty"
            />
            <HeroChip
              icon={<BadgeCheck className="size-5" />}
              value={`SLMC ${me.slmcNumber || "—"}`}
              label="Registration"
              className="ml-10"
            />
          </>
        }
        overlap={
          <div className="stagger grid gap-4 sm:grid-cols-3">
            {SHORTCUTS.map(({ href, label, hint, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-4 rounded-lg border border-border-subtle bg-surface p-5 shadow-md transition-[transform,box-shadow] duration-[200ms] ease-out can-hover:hover:-translate-y-0.5 can-hover:hover:shadow-lg"
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint text-brand"
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-h5 text-ink">{label}</span>
                  <span className="mt-0.5 block text-body-sm text-muted">{hint}</span>
                </span>
              </Link>
            ))}
          </div>
        }
      />

      {analyticsError ? (
        <Alert tone="warning" title="Analytics unavailable">
          {analyticsError}
        </Alert>
      ) : (
        <PracticeOverview summary={summary} peak={peak} />
      )}
    </div>
  );
}
