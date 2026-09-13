"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/consumer/ui/Card";
import { Button, ButtonLink } from "@/components/consumer/ui/Button";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { browserApi } from "@/lib/consumer/api/client";
import { isNotFound } from "@/lib/consumer/api/envelope";
import type { Appointment, ClinicalNote, Prescription, PrescriptionPdf } from "@/lib/consumer/api/types";
import {
  clinicalNotePath,
  noteVisibleToPatient,
  prescriptionLookupPath,
  shouldStopPolling,
} from "@/lib/consumer/features/visit-summary";

export function VisitSummaryClient({ appointmentId }: { appointmentId: string }) {
  const [appointment, setAppointment] = useState<Appointment | null>(null);
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
              .then((a) => {
                haveAppointment = true;
                if (!cancelled) setAppointment(a);
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
    const pdf = await browserApi<PrescriptionPdf>(`/prescriptions/${rx.id}/pdf`);
    if (pdf.pdf_url) window.open(pdf.pdf_url, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return <FormSkeleton />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <h1 className="text-h4 text-ink">Visit summary</h1>
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <Card className="flex flex-col gap-2">
        <p className="text-body font-medium text-ink">{appointment?.specialty || "Consultation"}</p>
        <p className="text-body-sm text-text-muted">
          {appointment?.start_at_local || appointment?.start_at || appointmentId}
          {appointment?.status ? ` · ${appointment.status}` : ""}
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-body font-medium text-black">Clinical note</p>
        {noteVisibleToPatient(note) ? (
          <>
            {note.assessment ? <p className="text-body text-black">{note.assessment}</p> : null}
            {note.plan ? <p className="text-body-sm text-text-muted">{note.plan}</p> : null}
            {note.diagnoses?.length ? (
              <ul className="text-body-sm text-text-muted">
                {note.diagnoses.map((d) => (
                  <li key={d.code}>
                    {d.code} {d.description || ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : note ? (
          <p className="text-body-sm text-text-muted">The doctor has a draft note. It appears here once signed.</p>
        ) : (
          <p className="text-body-sm text-text-muted">Waiting for the doctor to finalise notes…</p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-body font-medium text-black">Prescription</p>
        {rx ? (
          <>
            <ul className="text-body-sm text-text-muted">
              {(rx.items || []).map((it, i) => (
                <li key={`${it.drug_name}-${i}`}>
                  {it.drug_name} {it.strength || ""} — {it.dosage}, {it.frequency}
                </li>
              ))}
            </ul>
            <Button type="button" fullWidth onClick={() => void downloadRx()}>
              Download e-Rx PDF
            </Button>
          </>
        ) : (
          <p className="text-body-sm text-text-muted">No e-prescription yet. This updates when the doctor issues one.</p>
        )}
      </Card>

      <ButtonLink href="/vault" variant="outline" fullWidth>
        Open health vault
      </ButtonLink>
    </div>
  );
}
