"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Download } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { Button } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { Input } from "@/components/consumer/ui/Input";
import { Modal } from "@/components/consumer/ui/Modal";
import { Select } from "@/components/consumer/ui/Select";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { browserApi } from "@/lib/consumer/api/client";
import { hasCode, isNotFound } from "@/lib/consumer/api/errors";
import type { Appointment, DoctorProfile, FitnessForWork, MedicalReport } from "@/lib/consumer/api/types";
import { ageAtVisitDate } from "@/lib/consumer/features/visit-patient";
import {
  blankReport,
  downloadMedicalReportPdf,
  fromIssuedReport,
  issueReportError,
  issueReportPayload,
  medicalReportPath,
  needsLeaveDates,
  type ReportDraft,
} from "@/lib/consumer/features/medical-report";
import { useStampImage } from "@/components/consumer/signature-card";

export function MedicalReportClient({
  appointmentId,
  embedded = false,
}: {
  appointmentId: string;
  embedded?: boolean;
}) {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [draft, setDraft] = useState<ReportDraft>(blankReport());
  const [issued, setIssued] = useState<MedicalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [stampVersion, setStampVersion] = useState(0);
  const signatureSrc = useStampImage("signature", stampVersion);
  const sealSrc = useStampImage("seal", stampVersion);

  const loadExisting = useCallback(async () => {
    try {
      const report = await browserApi<MedicalReport>(medicalReportPath(appointmentId));
      setIssued(report);
      setDraft(fromIssuedReport(report));
      return report;
    } catch (e) {
      if (!isNotFound(e)) throw e;
      return null;
    }
  }, [appointmentId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, appt] = await Promise.all([
          browserApi<DoctorProfile>("/doctors/me"),
          browserApi<Appointment>(`/appointments/${appointmentId}`).catch(() => null),
          loadExisting(),
        ]);
        if (cancelled) return;
        setDoctor(me);
        setAppointment(appt);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load medical report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, loadExisting]);

  function patch(update: Partial<ReportDraft>) {
    setDraft((prev) => ({ ...prev, ...update }));
  }

  async function openPdf(id: string) {
    setError(null);
    try {
      await downloadMedicalReportPdf(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the medical report PDF.");
    }
  }

  function requestIssue() {
    setError(null);
    const validation = issueReportError(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setConfirming(true);
  }

  async function issue() {
    setConfirming(false);
    setIssuing(true);
    try {
      const created = await browserApi<MedicalReport>(medicalReportPath(appointmentId), {
        method: "POST",
        body: issueReportPayload(draft),
      });
      setIssued(created);
      setDraft(fromIssuedReport(created));
    } catch (e) {
      if (hasCode(e, "stamps_required")) {
        setStampVersion((v) => v + 1);
        setError("Add your signature and seal in your profile before issuing.");
        return;
      }
      if (hasCode(e, "medical_report_exists")) {
        try {
          const existing = await loadExisting();
          if (existing) {
            setError("A medical report already exists for this visit.");
            return;
          }
        } catch {
          /* fall through */
        }
      }
      setError(e instanceof Error ? e.message : "Could not issue medical report");
    } finally {
      setIssuing(false);
    }
  }

  if (loading) {
    return <FormSkeleton />;
  }

  const credentialsMissing = signatureSrc === null || sealSrc === null;
  const locked = Boolean(issued);
  const patient = appointment?.visitPatient;
  const patientAge =
    patient?.dateOfBirth && appointment ? ageAtVisitDate(patient.dateOfBirth, appointment.startAt) : null;
  const leave = needsLeaveDates(draft.fitness);

  return (
    <div className="@container mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {embedded ? null : <h1 className="text-h2 text-ink">Medical report</h1>}
          <div className={embedded ? undefined : "mt-2"}>
            {issued ? (
              <Badge tone="success">Issued {issued.issuedAt.slice(0, 10)}</Badge>
            ) : (
              <Badge tone="neutral">Signed PDF once issued</Badge>
            )}
          </div>
        </div>
        {embedded ? null : (
          <Link
            href={`/appointments/${appointmentId}/clinical-notes`}
            className="inline-flex min-h-11 items-center gap-1 text-body-sm font-semibold text-brand underline-offset-4 can-hover:hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Clinical notes
          </Link>
        )}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card className="flex flex-col gap-4">
        <p className="text-body-sm text-muted">
          Doctor:{" "}
          <span className="font-semibold text-ink">{issued?.doctorName || doctor?.displayName || "Doctor"}</span> ·
          SLMC {issued?.doctorSlmc || doctor?.slmcNumber || "—"}
        </p>
        <dl className="grid gap-3 text-body-sm @md:grid-cols-2">
          <div className="@md:col-span-2">
            <dt className="text-muted">Patient</dt>
            <dd className="font-semibold text-ink">{patient?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Age</dt>
            <dd className="text-ink">{patientAge != null ? `${patientAge} years` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Sex</dt>
            <dd className="capitalize text-ink">{patient?.sex || "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card className="flex flex-col gap-3">
        <LabeledField label="Addressed to">
          <Input
            value={draft.addressee}
            onChange={(e) => patch({ addressee: e.target.value })}
            placeholder="To whom it may concern"
            disabled={locked}
          />
        </LabeledField>
        <LabeledField label="Clinical impression">
          <Input
            value={draft.clinicalImpression}
            onChange={(e) => patch({ clinicalImpression: e.target.value })}
            placeholder="Acute viral illness"
            disabled={locked}
          />
        </LabeledField>
        <LabeledField label="Findings">
          <Textarea
            value={draft.findings}
            onChange={(e) => patch({ findings: e.target.value })}
            placeholder="What you observed on this visit"
            disabled={locked}
          />
        </LabeledField>
        <LabeledField label="Advice">
          <Textarea
            value={draft.advice}
            onChange={(e) => patch({ advice: e.target.value })}
            placeholder="Drink more water. Rest."
            disabled={locked}
          />
        </LabeledField>
      </Card>

      <Card className="flex flex-col gap-3">
        <p className="text-h5 text-ink">Fitness for work</p>
        <LabeledField label="Assessment">
          <Select
            value={draft.fitness}
            onChange={(e) => patch({ fitness: e.target.value as FitnessForWork })}
            disabled={locked}
          >
            <option value="notAssessed">Not assessed</option>
            <option value="fit">Fit for usual work</option>
            <option value="unfit">Unfit — medical leave</option>
            <option value="restricted">Fit with restrictions</option>
          </Select>
        </LabeledField>
        {leave || draft.fitness === "fit" ? (
          <div className="grid gap-3 @md:grid-cols-3">
            <LabeledField label="Leave from">
              <Input
                type="date"
                value={draft.leaveFrom}
                onChange={(e) => patch({ leaveFrom: e.target.value })}
                disabled={locked}
              />
            </LabeledField>
            <LabeledField label="Leave until">
              <Input
                type="date"
                value={draft.leaveUntil}
                onChange={(e) => patch({ leaveUntil: e.target.value })}
                disabled={locked}
              />
            </LabeledField>
            <LabeledField label="Resume work on">
              <Input
                type="date"
                value={draft.returnToWorkOn}
                onChange={(e) => patch({ returnToWorkOn: e.target.value })}
                disabled={locked}
              />
            </LabeledField>
          </div>
        ) : null}
        {draft.fitness !== "notAssessed" ? (
          <LabeledField label="Work notes">
            <Textarea
              value={draft.fitnessNotes}
              onChange={(e) => patch({ fitnessNotes: e.target.value })}
              placeholder="Please grant medical leave from routine work."
              disabled={locked}
            />
          </LabeledField>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-4">
        <p className="text-label text-ink">Signature &amp; seal</p>
        {credentialsMissing ? (
          <Alert tone="warning">
            Add your signature and seal before issuing.{" "}
            <Link href="/profile#signature" className="font-semibold text-brand underline underline-offset-4">
              Open profile
            </Link>
          </Alert>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <CredentialPreview label="Signature" src={signatureSrc} />
          <CredentialPreview label="Seal" src={sealSrc} />
        </div>
      </Card>

      {issued ? (
        <Button size="lg" fullWidth leading={<Download className="size-4" />} onClick={() => void openPdf(issued.id)}>
          Download PDF
        </Button>
      ) : (
        <Button
          size="lg"
          fullWidth
          busy={issuing}
          disabled={credentialsMissing}
          onClick={requestIssue}
        >
          {issuing ? "Generating PDF…" : "Issue medical report"}
        </Button>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Issue this medical report?"
        description="Issued reports are signed and cannot be edited. Check the patient, dates, and clinical impression first."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep editing
            </Button>
            <Button onClick={() => void issue()}>Issue and sign</Button>
          </>
        }
      />
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label text-muted">{label}</span>
      {children}
    </label>
  );
}

function CredentialPreview({ label, src }: { label: string; src: string | null | undefined }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border-default bg-surface p-2">
        {src === undefined ? (
          <span className="h-10 w-3/4 animate-pulse rounded bg-ink-50" />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img src={src} alt={`Your ${label.toLowerCase()}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-body-sm text-faint">Not added</span>
        )}
      </div>
      <figcaption className="text-body-sm text-muted">{label}</figcaption>
    </figure>
  );
}
