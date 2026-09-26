"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button, ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { StatusBadge } from "@/components/consumer/ui/StatusBadge";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { browserApi } from "@/lib/consumer/api/client";
import { isNotFound } from "@/lib/consumer/api/errors";
import type { Appointment, ClinicalNote, Doctor, Prescription } from "@/lib/consumer/api/types";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";
import {
  clinicalNotePath,
  noteVisibleToPatient,
  prescriptionLookupPath,
  shouldStopPolling,
} from "@/lib/consumer/features/visit-summary";
import { downloadPrescriptionPdf } from "@/lib/consumer/features/prescription";

export function VisitSummaryClient({ appointmentId }: { appointmentId: string }) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [rx, setRx] = useState<Prescription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let haveNote = false;
    let haveRx = false;
    let haveAppointment = false;

    async function tick(first: boolean) {
      try {
        const jobs: Promise<void>[] = [];
        if (!haveAppointment) {
          jobs.push(
            browserApi<Appointment>(`/appointments/${appointmentId}`)
              .then(async (a) => {
                haveAppointment = true;
                if (!cancelled) setAppointment(a);
                const doctor = await browserApi<Doctor>(`/doctors/${a.doctorId}`).catch(() => null);
                if (!cancelled && doctor?.displayName) setDoctorName(doctor.displayName);
              })
              .catch(() => undefined),
          );
        }
        if (!haveNote) {
          jobs.push(
            browserApi<ClinicalNote>(clinicalNotePath(appointmentId))
              .then((n) => {
                if (noteVisibleToPatient(n)) haveNote = true;
                if (!cancelled) setNote(n);
              })
              .catch((e) => {
                if (!isNotFound(e)) throw e;
              }),
          );
        }
        if (!haveRx) {
          jobs.push(
            browserApi<Prescription>(prescriptionLookupPath(appointmentId))
              .then((p) => {
                haveRx = true;
                if (!cancelled) setRx(p);
              })
              .catch((e) => {
                if (!isNotFound(e)) throw e;
              }),
          );
        }
        await Promise.all(jobs);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load summary");
      } finally {
        if (first && !cancelled) setLoading(false);
      }
    }

    void tick(true);
    const timer = window.setInterval(() => {
      attempts += 1;
      if (shouldStopPolling({ noteFinalised: haveNote, haveRx, attempts })) {
        window.clearInterval(timer);
        return;
      }
      void tick(false);
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [appointmentId]);

  async function downloadRx() {
    if (!rx) return;
    setError(null);
    try {
      await downloadPrescriptionPdf(rx.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the prescription PDF.");
    }
  }

  if (loading) {
    return <FormSkeleton />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <h1 className="text-h2 text-ink">Visit summary</h1>
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card variant="tint" className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-h5 text-ink">{doctorName || "Consultation"}</p>
          {appointment ? (
            <p className="mt-1 text-body-sm text-muted tabular-time">
              {formatVisitDate(appointment.startAt)} · {formatVisitClock(appointment.startAt)}
            </p>
          ) : null}
        </div>
        {appointment?.status ? <StatusBadge status={appointment.status} /> : null}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-h5 text-ink">Clinical note</h2>
        {noteVisibleToPatient(note) ? (
          <>
            {note.assessment ? <p className="text-body text-ink">{note.assessment}</p> : null}
            {note.plan ? <p className="text-body-sm text-muted">{note.plan}</p> : null}
            {note.diagnoses?.length ? (
              <ul className="flex flex-col gap-1 text-body-sm text-muted">
                {note.diagnoses.map((d) => (
                  <li key={d.code}>
                    <span className="font-semibold text-ink">{d.code}</span> {d.display}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : note ? (
          <p className="text-body-sm text-muted">
            The doctor has a draft note. It appears here once it is signed.
          </p>
        ) : (
          <p className="text-body-sm text-muted">Waiting for the doctor to finalise notes…</p>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-h5 text-ink">Prescription</h2>
        {rx ? (
          <>
            <ul className="flex flex-col gap-2">
              {rx.items.map((it, i) => (
                <li key={`${it.drugName}-${i}`} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-tint text-brand"
                  >
                    <FileText className="size-4" />
                  </span>
                  <span className="min-w-0 text-body-sm text-muted">
                    <span className="font-semibold text-ink">
                      {it.drugName} {it.strength}
                    </span>
                    <br />
                    {it.dosage}, {it.frequency}
                  </span>
                </li>
              ))}
            </ul>
            <Button fullWidth leading={<Download className="size-4" />} onClick={() => void downloadRx()}>
              Download prescription PDF
            </Button>
          </>
        ) : (
          <p className="text-body-sm text-muted">
            No prescription yet. This updates when the doctor issues one.
          </p>
        )}
      </Card>

      <ButtonLink href="/vault" variant="outline" fullWidth>
        Open health vault
      </ButtonLink>
    </div>
  );
}
