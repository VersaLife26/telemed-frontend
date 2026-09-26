"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { Button } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { Input } from "@/components/consumer/ui/Input";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { browserApi } from "@/lib/consumer/api/client";
import { hasCode, isNotFound } from "@/lib/consumer/api/errors";
import type { ClinicalNote, ClinicalNoteDiagnosis, Icd10Code } from "@/lib/consumer/api/types";
import { ReadyForNextButton } from "@/components/consumer/ready-for-next-button";
import {
  SOAP_SECTIONS,
  addDiagnosis as appendDiagnosis,
  AMEND_NO_CHANGE,
  amendPayload,
  amendReasonError,
  applyNote,
  canSearchReference,
  clinicalNotePath,
  emptyDraft,
  finalisePayload,
  hasSoapContent,
  removeDiagnosis as dropDiagnosis,
  savePayload,
  setPrimary as markPrimary,
  shouldAutosave,
  soapUnchanged,
  type SoapDraft,
  type SoapSectionKey,
} from "@/lib/consumer/features/clinical-notes";

export function ClinicalNotesClient({
  appointmentId,
  embedded = false,
}: {
  appointmentId: string;
  embedded?: boolean;
}) {
  const [draft, setDraft] = useState<SoapDraft>(emptyDraft);
  const [diagnoses, setDiagnoses] = useState<ClinicalNoteDiagnosis[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [status, setStatus] = useState<ClinicalNote["status"]>("draft");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [icdQuery, setIcdQuery] = useState("");
  const [icdHits, setIcdHits] = useState<Icd10Code[]>([]);
  const [finalising, setFinalising] = useState(false);
  const [amending, setAmending] = useState(false);
  const [amendReason, setAmendReason] = useState("");
  const [baseline, setBaseline] = useState<SoapDraft>(emptyDraft);
  const [baselineDx, setBaselineDx] = useState<ClinicalNoteDiagnosis[]>([]);

  const versionRef = useRef<number | null>(null);
  const draftRef = useRef(draft);
  const diagnosesRef = useRef(diagnoses);
  const saveTimer = useRef<number | null>(null);
  const icdTimer = useRef<number | null>(null);

  draftRef.current = draft;
  diagnosesRef.current = diagnoses;
  versionRef.current = version;

  const applyServer = useCallback((note: ClinicalNote) => {
    const nextDraft = applyNote(note);
    const nextDx = note.diagnoses || [];
    setDraft(nextDraft);
    setDiagnoses(nextDx);
    setBaseline(nextDraft);
    setBaselineDx(nextDx);
    setVersion(note.version);
    versionRef.current = note.version;
    setStatus(note.status);
  }, []);

  const save = useCallback(
    async (next?: { draft?: SoapDraft; diagnoses?: ClinicalNoteDiagnosis[] }) => {
      const bodyDraft = next?.draft ?? draftRef.current;
      const bodyDx = next?.diagnoses ?? diagnosesRef.current;
      setSaveState("saving");
      setError(null);
      try {
        const note = await browserApi<ClinicalNote>(clinicalNotePath(appointmentId), {
          method: "PUT",
          body: savePayload(bodyDraft, bodyDx, versionRef.current),
        });
        applyServer(note);
        setSaveState("saved");
      } catch (e) {
        if (hasCode(e, "concurrency_conflict") || hasCode(e, "note_finalised")) {
          try {
            const latest = await browserApi<ClinicalNote>(clinicalNotePath(appointmentId));
            applyServer(latest);
            setError(
              hasCode(e, "note_finalised")
                ? "This note was signed elsewhere — reloaded it. Use an amendment to change it."
                : "Saved on another device — reloaded the latest note.",
            );
          } catch {
            setError(e instanceof Error ? e.message : "Could not save note");
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
        const note = await browserApi<ClinicalNote>(clinicalNotePath(appointmentId));
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
        setIcdHits(await browserApi<Icd10Code[]>(`/icd10?q=${encodeURIComponent(q)}`));
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
      const note = await browserApi<ClinicalNote>(clinicalNotePath(appointmentId, "finalise"), {
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
    if (soapUnchanged(draft, baseline, diagnoses, baselineDx)) {
      setError(AMEND_NO_CHANGE);
      return;
    }
    setAmending(true);
    setError(null);
    try {
      const note = await browserApi<ClinicalNote>(clinicalNotePath(appointmentId, "amend"), {
        method: "POST",
        body: amendPayload(draft, diagnoses, amendReason, version),
      });
      applyServer(note);
      setAmendReason("");
      setSaveState("saved");
    } catch (e) {
      if (hasCode(e, "no_change")) setError(AMEND_NO_CHANGE);
      else setError(e instanceof Error ? e.message : "Could not amend note");
    } finally {
      setAmending(false);
    }
  }

  const locked = status === "finalised";
  const hasContent = hasSoapContent(draft, diagnoses);
  const amendDirty = !soapUnchanged(draft, baseline, diagnoses, baselineDx);

  if (loading) {
    return <FormSkeleton />;
  }

  return (
    <div className="@container mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {embedded ? null : <h1 className="text-h2 text-ink">Clinical notes</h1>}
          <div className={embedded ? "flex flex-wrap items-center gap-2" : "mt-2 flex flex-wrap items-center gap-2"}>
            <Badge tone={status === "finalised" ? "success" : "warning"}>
              {status === "finalised" ? "Signed" : "Draft"}
            </Badge>
            {/* Autosave state as a badge, not a sentence: it changes every few
                seconds and should not push the layout around when it does. */}
            {saveState === "saving" ? (
              <Badge tone="neutral">Saving…</Badge>
            ) : saveState === "saved" ? (
              <Badge tone="success">Saved</Badge>
            ) : null}
          </div>
        </div>
        {embedded ? null : (
          <Link
            href={`/appointments/${appointmentId}/prescription`}
            className="inline-flex min-h-11 items-center gap-1 text-body-sm font-semibold text-brand underline-offset-4 can-hover:hover:underline"
          >
            Write prescription
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>

      {embedded ? null : <ReadyForNextButton appointmentId={appointmentId} />}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {SOAP_SECTIONS.map((section) => (
        <Card key={section.key}>
          <Textarea
            id={section.key}
            label={
              <>
                {section.label}
                <span className="ml-2 font-normal text-faint">{section.hint}</span>
              </>
            }
            value={draft[section.key]}
            onChange={(e) => patchSection(section.key, e.target.value)}
            maxLength={20000}
          />
        </Card>
      ))}

      <Card className="flex flex-col gap-4">
        <h2 className="text-h4 text-ink">ICD-10 diagnoses</h2>

        <div className="relative">
          <Input
            id="icd-search"
            value={icdQuery}
            onChange={(e) => setIcdQuery(e.target.value)}
            placeholder="Search code or term (dengue, E11, lepto…)"
            aria-label="Search ICD-10 codes"
          />
          {icdHits.length ? (
            <ul className="absolute z-10 mt-2 max-h-56 w-full overflow-auto rounded-md border border-border-subtle bg-surface p-2 shadow-lg">
              {icdHits.map((hit) => (
                <li key={hit.code}>
                  <button
                    type="button"
                    className="w-full cursor-pointer rounded-sm px-3 py-2 text-left text-body-sm text-ink transition-colors duration-[160ms] ease-out can-hover:hover:bg-tint"
                    onClick={() => addDiagnosis(hit)}
                  >
                    <span className="font-semibold">{hit.code}</span> {hit.display}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {diagnoses.length ? (
          <ul className="flex flex-col gap-2">
            {diagnoses.map((d) => (
              <li
                key={d.code}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-tint px-4 py-3"
              >
                <p className="text-body-sm text-ink">
                  <span className="font-semibold">{d.code}</span> {d.display}
                  {d.isPrimary ? (
                    <Badge tone="brand" className="ml-2">
                      primary
                    </Badge>
                  ) : null}
                </p>
                <div className="flex gap-1">
                  {!d.isPrimary ? (
                    <Button size="sm" variant="ghost" onClick={() => setPrimary(d.code)}>
                      Make primary
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => removeDiagnosis(d.code)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-muted">No coded diagnoses yet.</p>
        )}
      </Card>

      {locked ? (
        <Card className="flex flex-col items-start gap-4">
          <div>
            <h2 className="text-h4 text-ink">Amend signed note</h2>
            <p className="mt-1 text-body-sm text-muted">
              Edit a section or diagnosis above, then save with a reason. The original signed text stays in the trail.
            </p>
          </div>
          <Input
            id="amend-reason"
            label="Reason for amendment"
            fieldClassName="w-full"
            value={amendReason}
            onChange={(e) => setAmendReason(e.target.value)}
          />
          <Button
            busy={amending}
            disabled={amending || !amendDirty || Boolean(amendReasonError(amendReason))}
            onClick={() => void amend()}
          >
            Save amendment
          </Button>
        </Card>
      ) : (
        <Button
          size="lg"
          fullWidth
          busy={finalising}
          disabled={finalising || !hasContent}
          onClick={() => void finalise()}
        >
          Finalise note
        </Button>
      )}
    </div>
  );
}
