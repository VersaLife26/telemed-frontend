"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/consumer/ui/Card";
import { AlertTriangle, ArrowLeft, Download, PenLine, Plus } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { Button } from "@/components/consumer/ui/Button";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { Input } from "@/components/consumer/ui/Input";
import { Modal } from "@/components/consumer/ui/Modal";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { SexField } from "@/components/consumer/sex-field";
import { browserApi } from "@/lib/consumer/api/client";
import { ApiError, isNotFound } from "@/lib/consumer/api/envelope";
import type { Appointment, Doctor, FormularyDrug, Prescription, Sex } from "@/lib/consumer/api/types";
import { prescriptionPatientFields } from "@/lib/consumer/features/visit-patient";
import {
  blankItem,
  canSearchFormulary,
  downloadPrescriptionPdf,
  fieldsFromDrug,
  fromIssued,
  issueError,
  issuePayload,
  lookupPath,
  sealImagePath,
  signatureImagePath,
  type ItemDraft,
} from "@/lib/consumer/features/prescription";

function useCredentialImage(path: string) {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    fetch(path, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok || !(res.headers.get("content-type") || "").startsWith("image/")) return null;
        url = URL.createObjectURL(await res.blob());
        return url;
      })
      .catch(() => null)
      .then((next) => {
        if (!cancelled) setSrc(next);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return src;
}

export function PrescriptionClient({
  appointmentId,
  embedded = false,
}: {
  appointmentId: string;
  embedded?: boolean;
}) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientSex, setPatientSex] = useState<Sex | "">("");
  const [patientWeight, setPatientWeight] = useState("");
  const [patientAllergies, setPatientAllergies] = useState("");
  const [patientLocked, setPatientLocked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const signatureSrc = useCredentialImage(signatureImagePath);
  const sealSrc = useCredentialImage(sealImagePath);
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
      const rx = await browserApi<Prescription>(lookupPath(appointmentId));
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
        const [me, appt, existing] = await Promise.all([
          browserApi<Doctor>("/doctors/me"),
          browserApi<Appointment>(`/appointments/${appointmentId}`).catch(() => null),
          loadExisting(),
        ]);
        if (cancelled) return;
        setDoctor(me);
        if (!existing) {
          const fields = prescriptionPatientFields(appt);
          if (fields.name) setPatientName(fields.name);
          if (fields.age) setPatientAge(fields.age);
          setPatientSex(fields.sex);
          setPatientWeight(fields.weightKg);
          setPatientAllergies(fields.allergies);
          setPatientLocked(fields.locked);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load prescription");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadExisting]);

  useEffect(() => {
    if (drugTimer.current) window.clearTimeout(drugTimer.current);
    const q = drugQuery.trim();
    if (!canSearchFormulary(q) || !activeItem) {
      setDrugHits([]);
      return;
    }
    drugTimer.current = window.setTimeout(async () => {
      try {
        const hits = await browserApi<FormularyDrug[]>(`/drugs?q=${encodeURIComponent(q)}`);
        setDrugHits(Array.isArray(hits) ? hits : []);
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
    const validation = issueError(patientName, doctor, items);
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
      const created = await browserApi<Prescription>("/prescriptions", {
        method: "POST",
        body: issuePayload({
          appointmentId,
          doctor,
          patientName,
          patientAge,
          patientSex,
          patientWeightKg: patientWeight,
          patientAllergies,
          items,
        }),
      });
      setIssued(created);
      setItems(fromIssued(created.items));
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
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

  const locked = Boolean(issued) || patientLocked;
  const credentialsMissing = signatureSrc === null || sealSrc === null;

  return (
    <div className="@container mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {embedded ? null : <h1 className="text-h2 text-ink">Prescription</h1>}
          <div className={embedded ? undefined : "mt-2"}>
            {issued ? (
              <Badge tone="success">Issued {issued.issued_at || ""}</Badge>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-body-sm text-muted">
            Prescriber: <span className="font-semibold text-ink">{doctor?.display_name || "Doctor"}</span>{" "}
            · SLMC {doctor?.slmc_number || "—"}
          </p>
          {patientLocked && !issued ? (
            <Button
              size="sm"
              variant="ghost"
              leading={<PenLine className="size-4" />}
              onClick={() => setPatientLocked(false)}
            >
              Edit patient details
            </Button>
          ) : null}
        </div>
        {patientAllergies ? (
          <div
            role="note"
            className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-tint px-3 py-2 text-body-sm text-ink"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              <span className="font-semibold">Allergies:</span> {patientAllergies}
            </span>
          </div>
        ) : null}
        <div className="grid gap-4 @md:grid-cols-2">
          <Input
            id="patient-name"
            label="Patient name"
            hint={patientLocked ? "From booking. Printed on the PDF." : "Printed on the PDF."}
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Kamala Silva"
            readOnly={patientLocked}
            disabled={locked}
            fieldClassName="@md:col-span-2"
          />
          <Input
            id="patient-age"
            label="Age"
            type="number"
            min={0}
            max={130}
            value={patientAge}
            onChange={(e) => setPatientAge(e.target.value)}
            readOnly={patientLocked}
            disabled={locked}
          />
          <Input
            id="patient-weight"
            label="Weight (kg)"
            type="number"
            inputMode="decimal"
            min={0.5}
            max={400}
            step={0.1}
            value={patientWeight}
            onChange={(e) => setPatientWeight(e.target.value)}
            readOnly={patientLocked}
            disabled={locked}
          />
          <div className="@md:col-span-2">
            <SexField id="patient-sex" value={patientSex} onChange={setPatientSex} disabled={locked} />
          </div>
          <Textarea
            id="patient-allergies"
            label="Known allergies"
            rows={2}
            className="min-h-16"
            value={patientAllergies}
            onChange={(e) => setPatientAllergies(e.target.value)}
            readOnly={patientLocked}
            disabled={locked}
            fieldClassName="@md:col-span-2"
          />
        </div>
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
              value={activeItem === item.key ? drugQuery || item.drug_name : item.drug_name}
              onChange={(e) => {
                setActiveItem(item.key);
                setDrugQuery(e.target.value);
                patchItem(item.key, { drug_name: e.target.value });
              }}
              onFocus={() => {
                setActiveItem(item.key);
                setDrugQuery(item.drug_name);
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
              value={item.strength || ""}
              onChange={(e) => patchItem(item.key, { strength: e.target.value })}
              placeholder="Strength"
              disabled={Boolean(issued)}
            />
            <Input
              value={item.form || ""}
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
              value={item.duration_days}
              onChange={(e) => patchItem(item.key, { duration_days: Number(e.target.value) || 1 })}
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
            value={item.instructions || ""}
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
          // eslint-disable-next-line @next/next/no-img-element -- blob: URL
          <img src={src} alt={`Your ${label.toLowerCase()}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-body-sm text-faint">Not added</span>
        )}
      </div>
      <figcaption className="text-body-sm text-muted">{label}</figcaption>
    </figure>
  );
}
