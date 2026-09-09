import Link from "next/link";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { apiFetch } from "@/lib/consumer/api/client";
import type { Doctor } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";

export default async function DashboardPage() {
  const token = await getAccessToken();
  if (!token) {
    return (
      <Card className="flex flex-col gap-4">
        <p className="text-body text-text-muted">
          Sign in with a doctor OTP session to load your profile from doctor-service.
        </p>
        <Link href="/login" className="max-w-xs">
          <Button>Sign in</Button>
        </Link>
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
      <Card className="flex flex-col gap-3">
        <p className="text-body-sm text-danger">{error || "No doctor profile"}</p>
        <p className="text-body-sm text-text-muted">
          If OTP succeeded as a patient account, register/approve a doctor profile first. Pending
          credentialing shows on Verification.
        </p>
        <Link href="/verification-pending" className="max-w-xs">
          <Button variant="outline">Verification status</Button>
        </Link>
      </Card>
    );
  }

  if (me.verification_status && me.verification_status !== "approved") {
    return (
      <Card className="flex flex-col gap-4">
        <h1 className="text-h4 text-black">Verification: {me.verification_status}</h1>
        <p className="text-body text-text-muted">
          Your profile is not approved yet. You can still review availability after approval.
        </p>
        <Link href="/verification-pending">
          <Button>View verification</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-2">
        <h1 className="text-h4 text-black">Good day, {me.display_name || "Doctor"}</h1>
        <p className="text-body text-text-muted">
          {me.specialty || "Specialty"} · SLMC {me.slmc_number || "—"}
        </p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/queue">
          <Card className="hover:border-border-card">
            <p className="text-h5 text-black">Queue</p>
            <p className="mt-2 text-body-sm text-text-muted">Today&apos;s appointments</p>
          </Card>
        </Link>
        <Link href="/availability">
          <Card className="hover:border-border-card">
            <p className="text-h5 text-black">Availability</p>
            <p className="mt-2 text-body-sm text-text-muted">Working hours</p>
          </Card>
        </Link>
        <Link href="/earnings">
          <Card className="hover:border-border-card">
            <p className="text-h5 text-black">Earnings</p>
            <p className="mt-2 text-body-sm text-text-muted">Payouts (soon)</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
