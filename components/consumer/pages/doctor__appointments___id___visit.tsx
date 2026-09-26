"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { StatusBadge } from "@/components/consumer/ui/StatusBadge";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment } from "@/lib/consumer/api/types";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";
import { ageAtVisitDate } from "@/lib/consumer/features/visit-patient";

export default function DoctorVisitDetailPage({ appointmentId }: { appointmentId: string }) {
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    browserApi<Appointment>(`/appointments/${appointmentId}`)
      .then((data) => {
        if (!cancelled) setAppt(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load visit");
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!appt) return <FormSkeleton />;

  const patient = appt.visitPatient?.name || "Patient";
  const age = appt.visitPatient?.dateOfBirth ? ageAtVisitDate(appt.visitPatient.dateOfBirth, appt.startAt) : 0;
  const symptoms = appt.intake?.symptoms || "";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Link
        href="/appointments"
        className="inline-flex min-h-11 items-center gap-1 text-body-sm font-semibold text-brand underline-offset-4 can-hover:hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All visits
      </Link>

      <Card className="flex flex-col gap-4">
        <h1 className="text-h2 text-ink">Visit details</h1>
        <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Patient</dt>
            <dd className="font-semibold text-ink">{patient}</dd>
          </div>
          {age > 0 ? (
            <div>
              <dt className="text-muted">Age at visit</dt>
              <dd className="font-semibold text-ink">{age} years</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted">When</dt>
            <dd className="tabular-time">
              {formatVisitDate(appt.startAt)} · {formatVisitClock(appt.startAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Status</dt>
            <dd>
              <StatusBadge status={appt.status} />
            </dd>
          </div>
        </dl>
        {symptoms ? (
          <div>
            <p className="text-label text-muted">Intake symptoms</p>
            <p className="mt-1 text-body text-ink">{symptoms}</p>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href={`/appointments/${appointmentId}/clinical-notes`}>Clinical notes</ButtonLink>
        <ButtonLink href={`/appointments/${appointmentId}/prescription`} variant="outline">
          Prescription
        </ButtonLink>
      </div>
    </div>
  );
}
