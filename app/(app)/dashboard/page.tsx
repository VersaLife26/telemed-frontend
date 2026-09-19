import Link from "next/link";
import { BadgeCheck, CalendarClock, ListOrdered, Stethoscope, Wallet } from "lucide-react";

import { PracticeOverview } from "@/components/consumer/practice-overview";
import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import type { PeakHours, PracticeSummary } from "@/lib/consumer/features/practice";
import { HeroChip, PageHero } from "@/components/consumer/ui/PageHero";
import { assets } from "@/lib/consumer/assets";
import { profilePhotoSrc } from "@/lib/consumer/features/profile";
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
          Sign in with a doctor OTP session to load your profile from doctor-service.
        </p>
        <ButtonLink href="/login">Sign in</ButtonLink>
      </Card>
    );
  }

  let me: Doctor | null = null;
  let error: string | null = null;
  try {
    me = await apiFetch<Doctor>("/api/v1/doctors/me", { token });
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

  if (me.verification_status && me.verification_status !== "approved") {
    return (
      <Card variant="tint" className="flex max-w-xl flex-col items-start gap-4">
        <Badge tone="warning">Verification: {me.verification_status}</Badge>
        <h1 className="text-h3 text-ink">Not approved yet</h1>
        <p className="text-body text-muted">
          Availability and bookings open up once the admin console approves your SLMC documents.
        </p>
        <ButtonLink href="/verification-pending">View verification</ButtonLink>
      </Card>
    );
  }

  let summary: PracticeSummary | null = null;
  let peak: PeakHours | null = null;
  let analyticsError: string | null = null;
  try {
    const [s, p] = await Promise.all([
      apiFetch<PracticeSummary>("/api/v1/doctors/me/analytics", { token }),
      apiFetch<PeakHours>("/api/v1/doctors/me/analytics/peak-hours", { token }),
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
        title={me.display_name || "Doctor"}
        image={profilePhotoSrc(me.photo_url) ?? assets.avatarPlaceholder}
        imageAlt={me.display_name || "Your profile photo"}
        framed
        chips={
          <>
            <HeroChip
              icon={<Stethoscope className="size-5" />}
              value={me.specialty || "Specialty"}
              label="Specialty"
            />
            <HeroChip
              icon={<BadgeCheck className="size-5" />}
              value={`SLMC ${me.slmc_number || "—"}`}
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
