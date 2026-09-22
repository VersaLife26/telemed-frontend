"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/consumer/ui/Card";
import { ArrowLeft, Download, Plus } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { Button } from "@/components/consumer/ui/Button";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { Input } from "@/components/consumer/ui/Input";
import { browserApi } from "@/lib/consumer/api/client";
import { ApiError, isNotFound } from "@/lib/consumer/api/envelope";
import type { Doctor, FormularyDrug, Prescription } from "@/lib/consumer/api/types";
import {
  blankItem,
  canSearchFormulary,
  downloadPrescriptionPdf,
  fieldsFromDrug,
  fromIssued,
  issueError,
  issuePayload,
  lookupPath,
  type ItemDraft,
} from "@/lib/consumer/features/prescription";

export function PrescriptionClient({ appointmentId }: { appointmentId: string }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("0");
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
        const [me] = await Promise.all([browserApi<Doctor>("/doctors/me"), loadExisting()]);
        if (!cancelled) setDoctor(me);
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

  async function issue() {
    setError(null);
    const validation = issueError(patientName, doctor, items);
    if (validation) {
      setError(validation);
      return;
    }
    setIssuing(true);
    try {
      const created = await browserApi<Prescription>("/prescriptions", {
        method: "POST",
        body: issuePayload({ appointmentId, doctor, patientName, patientAge, items }),
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h2 text-ink">Prescription</h1>
          <div className="mt-2">
            {issued ? (
              <Badge tone="success">Issued {issued.issued_at || ""}</Badge>
            ) : (
              <Badge tone="neutral">PDF with QR once issued</Badge>
            )}
          </div>
        </div>
        <Link
          href={`/appointments/${appointmentId}/clinical-notes`}
          className="inline-flex min-h-11 items-center gap-1 text-body-sm font-semibold text-brand underline-offset-4 can-hover:hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Clinical notes
        </Link>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card className="flex flex-col gap-5">
        <p className="text-body-sm text-muted">
          Prescriber: <span className="font-semibold text-ink">{doctor?.display_name || "Doctor"}</span>{" "}
          · SLMC {doctor?.slmc_number || "—"}
        </p>
        <Input
          id="patient-name"
          label="Patient name"
          hint="Printed on the PDF."
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          placeholder="Kamala Silva"
          disabled={Boolean(issued)}
        />
        <Input
          id="patient-age"
          label="Age"
          type="number"
          min={0}
          max={130}
          value={patientAge}
          onChange={(e) => setPatientAge(e.target.value)}
          disabled={Boolean(issued)}
        />
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
          <div className="grid gap-3 sm:grid-cols-2">
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

      {issued ? (
        <Button size="lg" fullWidth leading={<Download className="size-4" />} onClick={() => void openPdf(issued.id)}>
          Download PDF
        </Button>
      ) : (
        <Button size="lg" fullWidth busy={issuing} onClick={() => void issue()}>
          {issuing ? "Generating PDF…" : "Issue prescription"}
        </Button>
      )}
    </div>
  );
}
