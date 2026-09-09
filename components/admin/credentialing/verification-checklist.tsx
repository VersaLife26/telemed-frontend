"use client";

import * as React from "react";
import { Check, CircleDashed, Info, Loader2, X } from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { Progress } from "@/components/admin/ui/progress";
import { endpoints } from "@/lib/admin/api/endpoints";
import { checklistFieldBody } from "@/lib/admin/api/adapters/credentialing";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type {
  ChecklistItemKey,
  PendingDoctor,
  VerificationChecklist,
} from "@/lib/admin/api/types";
import {
  CHECKLIST_ITEMS,
  MINIMUM_EXPERIENCE_YEARS,
  answeredCount,
  checkSlmcFormat,
  meetsExperienceBar,
} from "@/lib/admin/credentialing";
import { formatDateTime } from "@/lib/admin/format";
import { cn } from "@/lib/admin/utils";

/**
 * The credentialing checklist.
 *
 * This is the part of the console that decides whether someone gets to
 * practise medicine on the platform, so it is built as a deliberate, auditable
 * sequence rather than a form:
 *
 *  - Each item is a **three-state** control — unanswered, yes, no — not a
 *    checkbox. An unticked checkbox is ambiguous between "I checked and it is
 *    wrong" and "I have not looked yet", and that ambiguity is exactly what a
 *    credentialing record must not contain.
 *  - Each answer is **persisted immediately**, with the reviewer's identity and
 *    a timestamp, so a half-finished review survives a dropped session and the
 *    record shows who checked what.
 *  - The list is a **radiogroup-style roving tab stop**: one Tab reaches the
 *    checklist, then Up/Down move between items and Y/N answer the focused one.
 *    Ten items of Tab-Tab-Tab is how a reviewer stops using the keyboard.
 *  - Where the console can pre-compute a signal — SLMC format, years of
 *    experience — it is shown *next to* the question as evidence, never used to
 *    answer it. A green tick that appeared on its own is a tick nobody made.
 */
export function VerificationChecklistPanel({
  doctor,
  checklist,
}: {
  doctor: PendingDoctor;
  checklist: VerificationChecklist;
}) {
  const [focusIndex, setFocusIndex] = React.useState(0);
  const [pending, setPending] = React.useState<ChecklistItemKey | null>(null);
  // The roving tab stop lives on each item's "Yes" button — a real <button>,
  // not a focusable <div>. Keyboard users land on an actual control, and the
  // arrow-key layer is a supplement to native button semantics rather than a
  // replacement for them.
  const yesButtonRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const decided = checklist.overall_status !== "pending";

  const mutation = useApiMutation<
    VerificationChecklist,
    { item: ChecklistItemKey; value: boolean }
  >({
    method: "PUT",
    path: () => endpoints.credentialing.checklist(doctor.doctor_id),
    body: (variables) => checklistFieldBody(variables.item, variables.value),
    onSuccess: () => setPending(null),
  });

  const answer = (item: ChecklistItemKey, value: boolean) => {
    if (decided) return;
    setPending(item);
    mutation.mutate({ item, value });
  };

  const moveTo = (index: number) => {
    setFocusIndex(index);
    yesButtonRefs.current[index]?.focus();
  };

  /**
   * Attached to the Yes/No buttons, which are interactive elements. Enter and
   * Space are left to the browser so a button still behaves like a button.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const item = CHECKLIST_ITEMS[index];
    if (!item) return;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        moveTo((index + 1) % CHECKLIST_ITEMS.length);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        moveTo((index - 1 + CHECKLIST_ITEMS.length) % CHECKLIST_ITEMS.length);
        break;
      case "Home":
        event.preventDefault();
        moveTo(0);
        break;
      case "End":
        event.preventDefault();
        moveTo(CHECKLIST_ITEMS.length - 1);
        break;
      case "y":
      case "Y":
        event.preventDefault();
        answer(item.key, true);
        break;
      case "n":
      case "N":
        event.preventDefault();
        answer(item.key, false);
        break;
      default:
        break;
    }
  };

  const answered = answeredCount(checklist);
  const slmc = checkSlmcFormat(doctor.slmc_number);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification checklist</CardTitle>
        <CardDescription>
          Every item is recorded against your account with a timestamp. Answer with the
          buttons, or focus the list and use{" "}
          <kbd className="rounded border border-border px-1 text-[11px]">Y</kbd> /{" "}
          <kbd className="rounded border border-border px-1 text-[11px]">N</kbd> and the
          arrow keys.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {answered} of {CHECKLIST_ITEMS.length} answered
            </span>
            {decided ? <Badge variant="muted">Decided — read only</Badge> : null}
          </div>
          <Progress
            value={(answered / CHECKLIST_ITEMS.length) * 100}
            aria-label={`Checklist progress: ${answered} of ${CHECKLIST_ITEMS.length} items answered`}
          />
        </div>

        <div
          role="group"
          aria-label="Credential checks"
          className="divide-y divide-border rounded-lg border border-border"
        >
          {CHECKLIST_ITEMS.map((definition, index) => {
            const state = checklist.items[definition.key];
            const value = state?.value ?? null;
            const isPending = pending === definition.key && mutation.isPending;

            return (
              <div
                key={definition.key}
                className={cn("space-y-2 p-4", index === focusIndex && "bg-accent/40")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <StateIcon value={value} />
                      {definition.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{definition.question}</p>
                    <p className="text-xs text-muted-foreground">
                      Evidence: {definition.evidence}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
                    ) : null}
                    <Button
                      ref={(node) => {
                        yesButtonRefs.current[index] = node;
                      }}
                      size="sm"
                      // One Tab reaches the checklist; arrows move within it.
                      tabIndex={index === focusIndex ? 0 : -1}
                      variant={value === true ? "success" : "outline"}
                      disabled={decided || mutation.isPending}
                      onFocus={() => setFocusIndex(index)}
                      onKeyDown={(event) => onKeyDown(event, index)}
                      onClick={() => answer(definition.key, true)}
                      aria-pressed={value === true}
                      aria-label={`${definition.label}: yes. ${definition.question}`}
                    >
                      <Check className="size-4" aria-hidden="true" />
                      Yes
                    </Button>
                    <Button
                      size="sm"
                      variant={value === false ? "destructive" : "outline"}
                      disabled={decided || mutation.isPending}
                      onFocus={() => setFocusIndex(index)}
                      onKeyDown={(event) => onKeyDown(event, index)}
                      onClick={() => answer(definition.key, false)}
                      aria-pressed={value === false}
                      aria-label={`${definition.label}: no. ${definition.question}`}
                    >
                      <X className="size-4" aria-hidden="true" />
                      No
                    </Button>
                  </div>
                </div>

                <Evidence definition={definition.key} doctor={doctor} slmcReason={slmc.reason} slmcValid={slmc.valid} />

                {state?.checked_at ? (
                  <p className="text-xs text-muted-foreground">
                    Answered {formatDateTime(state.checked_at)}
                    {state.checked_by ? " by another reviewer" : ""}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StateIcon({ value }: { value: boolean | null }) {
  if (value === true) {
    return <Check className="size-4 text-success" aria-hidden="true" />;
  }
  if (value === false) {
    return <X className="size-4 text-destructive" aria-hidden="true" />;
  }
  return <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />;
}

/**
 * Pre-computed signal for the items where the console can offer one. Presented
 * as evidence beside the question, deliberately not as an answer to it.
 */
function Evidence({
  definition,
  doctor,
  slmcReason,
  slmcValid,
}: {
  definition: ChecklistItemKey;
  doctor: PendingDoctor;
  slmcReason: string;
  slmcValid: boolean;
}) {
  if (definition === "slmc_format_valid") {
    return (
      <p
        className={cn(
          "flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-xs",
          slmcValid
            ? "border-border bg-muted/50 text-muted-foreground"
            : "border-destructive/40 bg-destructive/10 text-foreground",
        )}
      >
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Submitted as <span className="font-mono">{doctor.slmc_number}</span>. {slmcReason}{" "}
          This is a format check only — it says nothing about whether the registration
          exists or is current.
        </span>
      </p>
    );
  }

  if (definition === "experience_verified") {
    const years = doctor.years_experience;
    const ok = meetsExperienceBar(years);
    return (
      <p
        className={cn(
          "flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-xs",
          ok
            ? "border-border bg-muted/50 text-muted-foreground"
            : "border-warning/40 bg-warning/10 text-foreground",
        )}
      >
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {years === null
            ? "No experience was stated on the registration."
            : `Stated as ${years} year${years === 1 ? "" : "s"}.`}{" "}
          The platform minimum is {MINIMUM_EXPERIENCE_YEARS} years. The stated figure is
          self-reported; confirm it against the qualification documents.
        </span>
      </p>
    );
  }

  return null;
}
