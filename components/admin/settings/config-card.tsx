"use client";

import * as React from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { DiffView } from "@/components/admin/payments/diff-view";
import { endpoints } from "@/lib/admin/api/endpoints";
import { useApiMutation } from "@/lib/admin/api/hooks";
import type { SystemConfig } from "@/lib/admin/api/types";
import { formatDateTime } from "@/lib/admin/format";

export interface NumberFieldSpec {
  key: string;
  label: string;
  help: string;
  min: number;
  max: number;
  step?: number;
  /** Rendered after the input, e.g. "minutes". */
  unit?: string;
}

/**
 * A versioned numeric configuration document, edited as a form.
 *
 * `system_configs` is append-only (migration 000003 blocks UPDATE and DELETE
 * with a trigger), so every save inserts a new version and the previous one
 * stays readable. That makes rollback a matter of re-saving the old values, and
 * it is why the diff below is worth showing even for four numbers: the record
 * of *what changed* is what someone will be reading at 3am, and it should be
 * visible before the change is made rather than reconstructed afterwards.
 */
export function NumericConfigCard<T extends object>({
  title,
  description,
  configKey,
  config,
  fields,
  readOnly,
}: {
  title: string;
  description: string;
  configKey: string;
  config: SystemConfig<T>;
  fields: readonly NumberFieldSpec[];
  readOnly: boolean;
}) {
  // `config.value` may carry non-numeric siblings — fee caps, for instance,
  // also hold a currency code and a per-specialty override map. Only the
  // declared numeric fields are read here, and only they are written back.
  const current = React.useMemo(
    () => normalise(config.value as Record<string, unknown>, fields),
    [config.value, fields],
  );
  const [draft, setDraft] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, String(current[field.key] ?? "")])),
  );

  const problems = fields
    .map((field) => {
      const raw = draft[field.key] ?? "";
      const value = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(value)) {
        return { key: field.key, message: `${field.label} must be a number.` };
      }
      if (value < field.min || value > field.max) {
        return {
          key: field.key,
          message: `${field.label} must be between ${field.min} and ${field.max}.`,
        };
      }
      return null;
    })
    .filter((entry) => entry !== null);

  const proposed = Object.fromEntries(
    fields.map((field) => [field.key, Number(draft[field.key] ?? 0)]),
  );

  const currentText = `${JSON.stringify(current, null, 2)}\n`;
  const proposedText = `${JSON.stringify(proposed, null, 2)}\n`;
  const dirty = currentText !== proposedText;

  const mutation = useApiMutation<SystemConfig<T>, void>({
    method: "PUT",
    path: () => endpoints.settings.config(configKey),
    body: () => ({
      // Merge rather than replace: a PUT that dropped the sibling keys would
      // silently delete the per-specialty fee overrides.
      value: { ...(config.value as Record<string, unknown>), ...proposed },
      previous_version: config.version,
    }),
    successMessage: () => `${title} saved as version ${config.version + 1}.`,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description} Version {config.version}, effective{" "}
          {formatDateTime(config.effective_from)}.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const id = `${configKey}-${field.key}`;
            const problem = problems.find((entry) => entry.key === field.key);
            return (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={id}>{field.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    readOnly={readOnly}
                    value={draft[field.key] ?? ""}
                    aria-invalid={problem !== undefined}
                    aria-describedby={`${id}-help`}
                    onChange={(event) =>
                      setDraft((state) => ({ ...state, [field.key]: event.target.value }))
                    }
                  />
                  {field.unit ? (
                    <span className="shrink-0 text-sm text-muted-foreground">{field.unit}</span>
                  ) : null}
                </div>
                <p
                  id={`${id}-help`}
                  className={
                    problem ? "text-xs text-destructive" : "text-xs text-muted-foreground"
                  }
                >
                  {problem?.message ?? field.help}
                </p>
              </div>
            );
          })}
        </div>

        {dirty && problems.length === 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">What will change</h3>
            <DiffView before={currentText} after={proposedText} />
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="justify-end gap-2">
        <Button
          variant="outline"
          disabled={!dirty}
          onClick={() =>
            setDraft(
              Object.fromEntries(
                fields.map((field) => [field.key, String(current[field.key] ?? "")]),
              ),
            )
          }
        >
          Discard
        </Button>
        <Button
          disabled={readOnly || !dirty || problems.length > 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <Save className="size-4" aria-hidden="true" />
          {mutation.isPending ? "Saving…" : "Save new version"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function normalise(
  value: Record<string, unknown>,
  fields: readonly NumberFieldSpec[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const field of fields) {
    const raw = value?.[field.key];
    out[field.key] = typeof raw === "number" && Number.isFinite(raw) ? raw : field.min;
  }
  return out;
}
