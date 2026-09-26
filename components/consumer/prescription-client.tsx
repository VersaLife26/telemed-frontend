"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/consumer/ui/Card";
import { AlertTriangle, ArrowLeft, Download, Plus } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { Button } from "@/components/consumer/ui/Button";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { Input } from "@/components/consumer/ui/Input";
import { Modal } from "@/components/consumer/ui/Modal";
import { browserApi } from "@/lib/consumer/api/client";
import { hasCode, isNotFound } from "@/lib/consumer/api/errors";
import type { Appointment, DoctorProfile, FormularyDrug, Prescription } from "@/lib/consumer/api/types";
import { ageAtVisitDate } from "@/lib/consumer/features/visit-patient";
import {
  blankItem,
  canSearchFormulary,
  downloadPrescriptionPdf,
  fieldsFromDrug,
  fromIssued,
  issueError,
  issuePayload,
  prescriptionPath,
  type ItemDraft,
} from "@/lib/consumer/features/prescription";
import { useStampImage } from "@/components/consumer/signature-card";

export function PrescriptionClient({
  appointmentId,
  embedded = false,
}: {
  appointmentId: string;
  embedded?: boolean;
}) {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [stampVersion, setStampVersion] = useState(0);
  const signatureSrc = useStampImage("signature", stampVersion);
  const sealSrc = useStampImage("seal", stampVersion);
  const [items, setItems] = useState<ItemDraft[]>([blankItem()]);
  const [issued, setIssued] = useState<Prescription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [drugQuery, setDrugQuery] = useState("");
  const [drugHits, setDrugHits] = useState<FormularyDrug[]>([]);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const drugTimer = useRef<number | null>(null);

  const loadExisting = useCallback(async () => {
    try {
      const rx = await browserApi<Prescription>(prescriptionPath(appointmentId));
      setIssued(rx);
      setItems(fromIssued(rx.items));
      return rx;
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
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load prescription");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, loadExisting]);

  useEffect(() => {
    if (drugTimer.current) window.clearTimeout(drugTimer.current);
    const q = drugQuery.trim();
    if (!canSearchFormulary(q) || !activeItem) {
      setDrugHits([]);
      return;
    }
    drugTimer.current = window.setTimeout(async () => {
      try {
        setDrugHits(await browserApi<FormularyDrug[]>(`/drugs?q=${encodeURIComponent(q)}`));
      } catch {
        setDrugHits([]);
      }
    }, 250);
    return () => {
      if (drugTimer.current) window.clearTimeout(drugTimer.current);
    };
  }, [activeItem, drugQuery]);

  function patchItem(key: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function pickDrug(key: string, drug: FormularyDrug) {
    patchItem(key, fieldsFromDrug(drug));
    setDrugQuery("");
    setDrugHits([]);
    setActiveItem(null);
  }

  async function openPdf(id: string) {
    setError(null);
    try {
      await downloadPrescriptionPdf(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the prescription PDF.");
    }
  }

  function requestIssue() {
    setError(null);
    const validation = issueError(items);
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
      const created = await browserApi<Prescription>(prescriptionPath(appointmentId), {
        method: "POST",
        body: issuePayload(items),
      });
      setIssued(created);
      setItems(fromIssued(created.items));
    } catch (e) {
      if (hasCode(e, "stamps_required")) {
        setStampVersion((v) => v + 1);
        setError("Add your signature and seal in your profile before issuing.");
        return;
      }
      if (hasCode(e, "prescription_exists")) {
        try {
          const existing = await loadExisting();
          if (existing) {
            setError("A prescription already exists for this visit.");
            return;
          }
        } catch {
          /* fall through */
        }
      }
      setError(e instanceof Error ? e.message : "Could not issue prescription");
    } finally {
      setIssuing(false);
    }
  }

  if (loading) {
    return <FormSkeleton />;
  }

  const credentialsMissing = signatureSrc === null || sealSrc === null;
  const patient = appointment?.visitPatient;
  const patientAge =
    patient?.dateOfBirth && appointment ? ageAtVisitDate(patient.dateOfBirth, appointment.startAt) : null;

  return (
    <div className="@container mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {embedded ? null : <h1 className="text-h2 text-ink">Prescription</h1>}
          <div className={embedded ? undefined : "mt-2"}>
            {issued ? (
              <Badge tone="success">Issued {issued.issuedAt.slice(0, 10)}</Badge>
            ) : (
              <Badge tone="neutral">PDF with QR once issued</Badge>
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

      <Card className="flex flex-col gap-5">
        <p className="text-body-sm text-muted">
          Prescriber:{" "}
          <span className="font-semibold text-ink">
            {issued?.doctorName || doctor?.displayName || "Doctor"}
          </span>{" "}
          · SLMC {issued?.doctorSlmc || doctor?.slmcNumber || "—"}
        </p>
        {patient?.allergies ? (
          <div
            role="note"
            className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-tint px-3 py-2 text-body-sm text-ink"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              <span className="font-semibold">Allergies:</span> {patient.allergies}
            </span>
          </div>
        ) : null}
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
            <dt className="text-muted">Weight</dt>
            <dd className="text-ink">{patient?.weightKg ? `${patient.weightKg} kg` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Sex</dt>
            <dd className="capitalize text-ink">{patient?.sex || "—"}</dd>
          </div>
        </dl>
        <p className="text-body-sm text-faint">From the booking. Printed on the PDF as shown.</p>
      </Card>

      {items.map((item, index) => (
        <Card key={item.key} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-h5 text-ink">Item {index + 1}</p>
            {!issued && items.length > 1 ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={() => setItems((prev) => prev.filter((it) => it.key !== item.key))}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <div className="relative">
            <Input
              value={activeItem === item.key ? drugQuery || item.drugName : item.drugName}
              onChange={(e) => {
                setActiveItem(item.key);
                setDrugQuery(e.target.value);
                patchItem(item.key, { drugName: e.target.value, drugId: null });
              }}
              onFocus={() => {
                setActiveItem(item.key);
                setDrugQuery(item.drugName);
              }}
              placeholder="Drug name — type to search formulary"
              disabled={Boolean(issued)}
            />
            {activeItem === item.key && drugHits.length ? (
              <ul className="absolute z-10 mt-2 max-h-56 w-full overflow-auto rounded-md border border-border-subtle bg-surface p-2 shadow-lg">
                {drugHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="w-full cursor-pointer rounded-sm px-3 py-2 text-left text-body-sm text-ink transition-colors duration-[160ms] ease-out can-hover:hover:bg-tint"
                      onClick={() => pickDrug(item.key, hit)}
                    >
                      {hit.name}
                      {hit.strength ? ` ${hit.strength}` : ""} {hit.form || ""}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="grid gap-3 @md:grid-cols-2">
            <Input
              value={item.strength}
              onChange={(e) => patchItem(item.key, { strength: e.target.value })}
              placeholder="Strength"
              disabled={Boolean(issued)}
            />
            <Input
              value={item.form}
              onChange={(e) => patchItem(item.key, { form: e.target.value })}
              placeholder="Form"
              disabled={Boolean(issued)}
            />
            <Input
              value={item.dosage}
              onChange={(e) => patchItem(item.key, { dosage: e.target.value })}
              placeholder="Dosage (1 capsule)"
              disabled={Boolean(issued)}
            />
            <Input
              value={item.frequency}
              onChange={(e) => patchItem(item.key, { frequency: e.target.value })}
              placeholder="Frequency (3x daily)"
              disabled={Boolean(issued)}
            />
            <Input
              type="number"
              min={1}
              max={365}
              value={item.durationDays}
              onChange={(e) => patchItem(item.key, { durationDays: Number(e.target.value) || 1 })}
              placeholder="Duration days"
              disabled={Boolean(issued)}
            />
            <Input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => patchItem(item.key, { quantity: Number(e.target.value) || 1 })}
              placeholder="Quantity"
              disabled={Boolean(issued)}
            />
          </div>
          <Input
            value={item.instructions}
            onChange={(e) => patchItem(item.key, { instructions: e.target.value })}
            placeholder="Instructions (after meals)"
            disabled={Boolean(issued)}
          />
        </Card>
      ))}

      {!issued ? (
        <Button
          variant="outline"
          className="self-start"
          leading={<Plus className="size-4" />}
          onClick={() => setItems((prev) => [...prev, blankItem(`item-${prev.length + 1}`)])}
        >
          Add another drug
        </Button>
      ) : null}

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
          {issuing ? "Generating PDF…" : "Issue prescription"}
        </Button>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Issue this prescription?"
        description="Issued prescriptions are signed and can't be changed. Check the patient details and every drug line first."
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
