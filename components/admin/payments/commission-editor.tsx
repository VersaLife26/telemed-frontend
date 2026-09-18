"use client";

import * as React from "react";
import { CircleCheck, FileJson, ShieldAlert, Wand2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { CommissionRuleSet, SystemConfig } from "@/lib/admin/api/types";
import { formatDateTime } from "@/lib/admin/format";
import {
  formatCommissionRules,
  parseCommissionRules,
} from "@/lib/admin/schemas/commission";

import { DiffView } from "./diff-view";
import { ConfigHistory } from "@/components/admin/settings/config-history";

/**
 * The commission rule editor.
 *
 * Editing this document changes what every doctor on the platform is paid, so
 * the flow is: edit → validate → **see the diff** → confirm. The diff step is
 * not optional and cannot be skipped, because the failure this screen exists to
 * prevent is not "invalid JSON" (the parser catches that) — it is a valid
 * document that says something different from what the admin meant. `"20"`
 * becoming `"2"` parses perfectly.
 *
 * The current document is re-serialised canonically before diffing, so the
 * comparison shows semantic edits rather than a reformat.
 */
export function CommissionEditor({
  config,
  readOnly,
}: {
  config: SystemConfig<CommissionRuleSet>;
  readOnly: boolean;
}) {
  const canonicalCurrent = React.useMemo(() => {
    const parsed = parseCommissionRules(JSON.stringify(config.value));
    return parsed.ok
      ? formatCommissionRules(parsed.value)
      : `${JSON.stringify(config.value, null, 2)}\n`;
  }, [config.value]);

  const [draft, setDraft] = React.useState(canonicalCurrent);
  const [confirming, setConfirming] = React.useState(false);

  const parsed = React.useMemo(() => parseCommissionRules(draft), [draft]);
  const canonicalDraft = parsed.ok ? formatCommissionRules(parsed.value) : draft;
  const dirty = canonicalDraft !== canonicalCurrent;

  const mutation = useApiMutation<SystemConfig<CommissionRuleSet>, void>({
    method: "PUT",
    path: () => endpoints.finance.commissionRules(),
    body: () => ({
      value: parsed.ok ? parsed.value : undefined,
    }),
    successMessage: () => "Commission rules saved as a new version.",
    onSuccess: () => setConfirming(false),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commission rules</CardTitle>
        <CardDescription>
          Version {config.version}, effective {formatDateTime(config.effective_from)}.
          Saving inserts a new version — the previous one is never overwritten, so a
          bad edit can be rolled back by re-saving the old document.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="commission-json">Rule document (JSON)</Label>
            <Button
              variant="ghost"
              size="sm"
              disabled={!parsed.ok || readOnly}
              onClick={() => {
                if (parsed.ok) setDraft(formatCommissionRules(parsed.value));
              }}
            >
              <Wand2 className="size-4" aria-hidden="true" />
              Format
            </Button>
          </div>
          <Textarea
            id="commission-json"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            readOnly={readOnly}
            rows={16}
            spellCheck={false}
            aria-invalid={!parsed.ok}
            aria-describedby="commission-json-status"
            className="font-mono text-xs"
          />
        </div>

        <div id="commission-json-status" aria-live="polite">
          {parsed.ok ? (
            <Alert variant="success">
              <CircleCheck aria-hidden="true" />
              <AlertTitle>
                Valid — {parsed.value.rules.length} specialty rule
                {parsed.value.rules.length === 1 ? "" : "s"}, default{" "}
                {parsed.value.default_commission_percent}%
              </AlertTitle>
              <AlertDescription>
                Every specialty without its own rule is charged the default.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <ShieldAlert aria-hidden="true" />
              <AlertTitle>
                {parsed.problems.length} problem
                {parsed.problems.length === 1 ? "" : "s"} — this cannot be saved
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-1 space-y-1">
                  {parsed.problems.map((problem, index) => (
                    <li key={index} className="font-mono text-xs">
                      {problem.path}: {problem.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {parsed.ok && dirty ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">What will change</h3>
            <DiffView before={canonicalCurrent} after={canonicalDraft} />
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="justify-between">
        <p className="text-xs text-muted-foreground">
          {readOnly
            ? "Read-only: editing commission rules requires the finance or super_admin role."
            : dirty
              ? "Review the diff above before saving."
              : "No unsaved changes."}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!dirty}
            onClick={() => setDraft(canonicalCurrent)}
          >
            Discard changes
          </Button>
          <Button
            disabled={readOnly || !parsed.ok || !dirty}
            onClick={() => setConfirming(true)}
          >
            <FileJson className="size-4" aria-hidden="true" />
            Review and save
          </Button>
        </div>
      </CardFooter>

      <CardContent>
        <h3 className="mb-2 text-sm font-medium">Version history</h3>
        <ConfigHistory
          configKey="commission_rules"
          path={endpoints.finance.commissionRuleHistory()}
        />
      </CardContent>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setConfirming(false);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Save commission rules as version {config.version + 1}?</DialogTitle>
            <DialogDescription>
              This changes what every doctor is paid on every consultation from the
              moment it takes effect. Read the diff once more.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-auto">
            <DiffView before={canonicalCurrent} after={canonicalDraft} />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={mutation.isPending}
            >
              Go back and edit
            </Button>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Saving…" : "Save new version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
