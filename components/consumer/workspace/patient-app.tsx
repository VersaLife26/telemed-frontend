"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Pill, StickyNote } from "lucide-react";

import { StatusBadge } from "@/components/consumer/ui/StatusBadge";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment } from "@/lib/consumer/api/types";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";
import { ageAtVisitDate } from "@/lib/consumer/features/visit-patient";

const SEX_LABEL = { female: "Female", male: "Male", other: "Other" } as const;

/** The booking snapshot for one visit: who the patient is and why they came. */
export function PatientApp({
  appointmentId,
  onOpen,
}: {
  appointmentId: string;
  onOpen: (app: "notes" | "rx") => void;
}) {
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    browserApi<Appointment>(`/appointments/${appointmentId}`)
      .then((a) => {
        if (!cancelled) setAppt(a);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the visit");
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  if (error) return <p className="p-4 text-body-sm text-white/70">{error}</p>;
  if (!appt) {
    return (
      <div className="flex flex-col gap-3 p-4" aria-busy="true">
        <div className="h-8 w-2/3 animate-pulse rounded bg-white/10" />
        <div className="h-24 animate-pulse rounded-lg bg-white/5" />
      </div>
    );
  }

  const p = appt.visitPatient;
  const age = p?.dateOfBirth ? ageAtVisitDate(p.dateOfBirth, appt.startAt) : 0;
  const allergies = p?.allergies?.trim() || "";
  const relation = appt.intake?.visitRelation || "";
  const facts: [string, string][] = [
    ["Age", age > 0 ? String(age) : "—"],
    ["Sex", p?.sex ? SEX_LABEL[p.sex] : "—"],
    ["Weight", p?.weightKg ? `${p.weightKg} kg` : "—"],
  ];

  return (
    <div className="@container flex h-full flex-col gap-4 overflow-y-auto p-4 text-white">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-h4">{p?.name || "Patient"}</h3>
          <StatusBadge status={appt.status} />
        </div>
        <p className="mt-1 text-body-sm text-white/60 tabular-time">
          {formatVisitDate(appt.startAt)} · {formatVisitClock(appt.startAt)}
          {relation ? ` · Booked by their ${relation}` : ""}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {facts.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-white/[0.06] p-3 ring-1 ring-white/10">
            <dt className="text-caption text-white/50">{k}</dt>
            <dd className="mt-0.5 text-label tabular-time">{v}</dd>
          </div>
        ))}
      </dl>

      <div
        className={
          allergies
            ? "flex gap-2 rounded-lg bg-warning/20 p-3 text-body-sm ring-1 ring-warning/40"
            : "rounded-lg bg-white/[0.06] p-3 text-body-sm text-white/60 ring-1 ring-white/10"
        }
      >
        {allergies ? <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-300" /> : null}
        <p>
          <span className="font-semibold text-white">Allergies: </span>
          {allergies || "None reported"}
        </p>
      </div>

      <section>
        <h4 className="text-caption uppercase tracking-wide text-white/50">Symptoms</h4>
        <p className="mt-1 whitespace-pre-wrap text-body-sm text-white/90">
          {appt.intake?.symptoms?.trim() || "Nothing entered at booking."}
        </p>
      </section>

      <div className="mt-auto grid gap-2 @xs:grid-cols-2">
        <button
          type="button"
          onClick={() => onOpen("notes")}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-pill bg-white/10 font-semibold transition-[background-color,scale] duration-[140ms] ease-out active:scale-[0.97] can-hover:hover:bg-white/20"
        >
          <StickyNote className="size-4" />
          Clinical notes
        </button>
        <button
          type="button"
          onClick={() => onOpen("rx")}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-pill bg-brand font-semibold transition-[background-color,scale] duration-[140ms] ease-out active:scale-[0.97] can-hover:hover:bg-brand-hover"
        >
          <Pill className="size-4" />
          Prescription
        </button>
      </div>
    </div>
  );
}
