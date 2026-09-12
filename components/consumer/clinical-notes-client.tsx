"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { browserApi } from "@/lib/consumer/api/client";
import { ApiError, isNotFound } from "@/lib/consumer/api/envelope";
import type { ClinicalNote, ClinicalNoteDiagnosis, Icd10Code } from "@/lib/consumer/api/types";
import { ReadyForNextButton } from "@/components/consumer/ready-for-next-button";
import {
  SOAP_SECTIONS,
  addDiagnosis as appendDiagnosis,
  amendPayload,
  amendReasonError,
  applyNote,
  canSearchReference,
  emptyDraft,
  finalisePayload,
  hasSoapContent,
  removeDiagnosis as dropDiagnosis,
  savePayload,
  setPrimary as markPrimary,
  shouldAutosave,
  type SoapDraft,
  type SoapSectionKey,
} from "@/lib/consumer/features/clinical-notes";

export function ClinicalNotesClient({ appointmentId }: { appointmentId: string }) {
  const [draft, setDraft] = useState<SoapDraft>(emptyDraft);
  const [diagnoses, setDiagnoses] = useState<ClinicalNoteDiagnosis[]>([]);
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<string>("draft");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [icdQuery, setIcdQuery] = useState("");
  const [icdHits, setIcdHits] = useState<Icd10Code[]>([]);
  const [finalising, setFinalising] = useState(false);
  const [amending, setAmending] = useState(false);
  const [amendReason, setAmendReason] = useState("");

  const versionRef = useRef(0);
  const draftRef = useRef(draft);
  const diagnosesRef = useRef(diagnoses);
  const saveTimer = useRef<number | null>(null);
  const icdTimer = useRef<number | null>(null);

  draftRef.current = draft;
  diagnosesRef.current = diagnoses;
  versionRef.current = version;

  const applyServer = useCallback((note: ClinicalNote) => {
    setDraft(applyNote(note));
    setDiagnoses(note.diagnoses || []);
    setVersion(note.version);
    versionRef.current = note.version;
    setStatus(note.status || "draft");
  }, []);

  const save = useCallback(
    async (next?: { draft?: SoapDraft; diagnoses?: ClinicalNoteDiagnosis[] }) => {
      const bodyDraft = next?.draft ?? draftRef.current;
      const bodyDx = next?.diagnoses ?? diagnosesRef.current;
      setSaveState("saving");
      setError(null);
      try {
        const note = await browserApi<ClinicalNote>(`/clinical-notes/${appointmentId}`, {
          method: "PUT",
          body: savePayload(appointmentId, bodyDraft, bodyDx, versionRef.current),
        });
        applyServer(note);
        setSaveState("saved");
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          try {
            const latest = await browserApi<ClinicalNote>(`/clinical-notes/${appointmentId}`);
            applyServer(latest);
            setError("Saved on another device — reloaded the latest note.");
          } catch {
            setError(e.message);
          }
        } else {
          setError(e instanceof Error ? e.message : "Could not save note");
        }
        setSaveState("error");
      }
    },
    [appointmentId, applyServer],
  );

  const scheduleSave = useCallback(
    (nextDraft: SoapDraft, nextDx: ClinicalNoteDiagnosis[]) => {
      if (!shouldAutosave(status)) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void save({ draft: nextDraft, diagnoses: nextDx });
      }, 800);
    },
    [save, status],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const note = await browserApi<ClinicalNote>(`/clinical-notes/${appointmentId}`);
        if (!cancelled) applyServer(note);
      } catch (e) {
        if (!cancelled && !isNotFound(e)) {
          setError(e instanceof Error ? e.message : "Could not load note");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [appointmentId, applyServer]);

  useEffect(() => {
    if (icdTimer.current) window.clearTimeout(icdTimer.current);
    const q = icdQuery.trim();
    if (!canSearchReference(q)) {
      setIcdHits([]);
      return;
    }
    icdTimer.current = window.setTimeout(async () => {
      try {
        const hits = await browserApi<Icd10Code[]>(`/icd10?q=${encodeURIComponent(q)}`);
        setIcdHits(Array.isArray(hits) ? hits : []);
      } catch {
        setIcdHits([]);
      }
    }, 250);
    return () => {
      if (icdTimer.current) window.clearTimeout(icdTimer.current);
    };
  }, [icdQuery]);

  function patchSection(key: SoapSectionKey, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    scheduleSave(next, diagnoses);
  }

  function addDiagnosis(code: Icd10Code) {
    const next = appendDiagnosis(diagnoses, code);
    if (next === diagnoses) return;
    setDiagnoses(next);
    setIcdQuery("");
    setIcdHits([]);
    scheduleSave(draft, next);
  }

  function removeDiagnosis(code: string) {
    const next = dropDiagnosis(diagnoses, code);
    setDiagnoses(next);
    scheduleSave(draft, next);
  }

  function setPrimary(code: string) {
    const next = markPrimary(diagnoses, code);
    setDiagnoses(next);
    scheduleSave(draft, next);
  }

  async function finalise() {
    setFinalising(true);
    setError(null);
    try {
      await save();
      const note = await browserApi<ClinicalNote>(`/clinical-notes/${appointmentId}/finalise`, {
        method: "POST",
        body: finalisePayload(versionRef.current),
      });
      applyServer(note);
      setSaveState("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finalise note");
    } finally {
      setFinalising(false);
    }
  }

  async function amend() {
    const reasonErr = amendReasonError(amendReason);
    if (reasonErr) {
      setError(reasonErr);
      return;
    }
    setAmending(true);
    setError(null);
    try {
      const note = await browserApi<ClinicalNote>(`/clinical-notes/${appointmentId}/amend`, {
        method: "POST",
        body: amendPayload(draft, diagnoses, amendReason, version),
      });
      applyServer(note);
      setAmendReason("");
      setSaveState("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not amend note");
    } finally {
      setAmending(false);
    }
  }

  const locked = status === "finalised";
  const hasContent = hasSoapContent(draft, diagnoses);

  if (loading) {
    return <p className="text-body text-text-muted">Loading clinical notes…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h4 text-black">Clinical notes</h1>
          <p className="mt-1 text-body-sm text-text-muted">
            SOAP note · {status === "finalised" ? "signed" : "draft"}
            {saveState === "saving" ? " · saving…" : saveState === "saved" ? " · saved" : ""}
          </p>
        </div>
        <Link href={`/appointments/${appointmentId}/prescription`} className="text-body-sm text-primary">
          Write prescription →
        </Link>
      </div>

      <ReadyForNextButton appointmentId={appointmentId} />

      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      {SOAP_SECTIONS.map((section) => (
        <Card key={section.key} className="flex flex-col gap-2">
          <label className="text-body font-medium text-black" htmlFor={section.key}>
            {section.label}
            <span className="ml-2 font-normal text-text-label">{section.hint}</span>
          </label>
          <Textarea
            id={section.key}
            value={draft[section.key]}
            onChange={(e) => patchSection(section.key, e.target.value)}
            maxLength={20000}
          />
        </Card>
      ))}

      <Card className="flex flex-col gap-3">
        <p className="text-body font-medium text-black">ICD-10 diagnoses</p>
        <div className="relative">
            <Input
              value={icdQuery}
              onChange={(e) => setIcdQuery(e.target.value)}
              placeholder="Search code or term (dengue, E11, lepto…)"
            />
            {icdHits.length ? (
              <ul className="absolute z-10 mt-2 max-h-56 w-full overflow-auto rounded-[16px] bg-white p-2 shadow-[var(--shadow-soft)]">
                {icdHits.map((hit) => (
                  <li key={hit.code}>
                    <button
                      type="button"
                      className="w-full rounded-[12px] px-3 py-2 text-left text-body-sm hover:bg-bg-gray"
                      onClick={() => addDiagnosis(hit)}
                    >
                      <span className="font-medium">{hit.code}</span> {hit.description}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        {diagnoses.length ? (
          <ul className="flex flex-col gap-2">
            {diagnoses.map((d) => (
              <li key={d.code} className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] bg-white px-4 py-2">
                <p className="text-body-sm">
                  <span className="font-medium">{d.code}</span> {d.description || ""}
                  {d.is_primary ? <span className="ml-2 text-primary">primary</span> : null}
                </p>
                <div className="flex gap-2">
                  {!d.is_primary ? (
                    <button type="button" className="text-body-sm text-primary" onClick={() => setPrimary(d.code)}>
                      Make primary
                    </button>
                  ) : null}
                  <button type="button" className="text-body-sm text-danger" onClick={() => removeDiagnosis(d.code)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-text-muted">No coded diagnoses yet.</p>
        )}
      </Card>

      {locked ? (
        <Card className="flex flex-col gap-3">
          <p className="text-body font-medium text-black">Amend signed note</p>
          <p className="text-body-sm text-text-muted">
            Changes write a revision. The original signed text stays in the trail.
          </p>
          <Input
            value={amendReason}
            onChange={(e) => setAmendReason(e.target.value)}
            placeholder="Reason for amendment"
          />
          <Button type="button" onClick={() => void amend()} disabled={amending} fullWidth={false}>
            {amending ? "Amending…" : "Save amendment"}
          </Button>
        </Card>
      ) : (
        <Button type="button" onClick={() => void finalise()} disabled={finalising || !hasContent}>
          {finalising ? "Signing…" : "Finalise note"}
        </Button>
      )}
    </div>
  );
}
