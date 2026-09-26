"use client";

import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Textarea } from "@/components/admin/ui/textarea";
import type { ApiError } from "@/lib/admin/api/errors";

export type FieldValue = string | boolean | string[];

export interface FieldSpec {
  name: string;
  label: string;
  kind: "text" | "textarea" | "select" | "boolean" | "list";
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** Shown but not editable when editing an existing row (e.g. a key used in the path). */
  fixedOnEdit?: boolean;
  /** Returns a message when the value is unacceptable, or null. */
  validate?: (value: FieldValue) => string | null;
}

/**
 * A dialog form built from a field spec.
 *
 * Content management is two entities with a dozen fields between them and no
 * interesting behaviour. Writing near-identical forms would guarantee that a
 * fix to label association or error announcement lands in only one of them.
 *
 * Server-side field errors are the point of interest: a validation problem
 * carries `errors: {fieldPath: [reason]}` on a 400, and those are mapped back
 * onto the inputs here — `aria-invalid` plus a described-by message on the
 * field itself, not a summary at the top that says "check your input".
 */
export function EntityEditor({
  open,
  editing,
  title,
  description,
  fields,
  initial,
  submitLabel,
  pending,
  serverError,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  editing: boolean;
  title: string;
  description?: string;
  fields: readonly FieldSpec[];
  initial: Record<string, FieldValue>;
  submitLabel: string;
  pending: boolean;
  serverError: ApiError | null;
  onCancel: () => void;
  onSubmit: (values: Record<string, FieldValue>) => void;
}) {
  const [values, setValues] = React.useState<Record<string, FieldValue>>(initial);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (open) {
      setValues(initial);
      setTouched({});
    }
    // `initial` is rebuilt by the parent on every render; keying the reset on
    // `open` is what makes it stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const localProblem = (field: FieldSpec): string | null => {
    const value = values[field.name] ?? "";
    if (field.required) {
      const empty =
        (typeof value === "string" && value.trim().length === 0) ||
        (Array.isArray(value) && value.length === 0);
      if (empty) return `${field.label} is required.`;
    }
    return field.validate ? field.validate(value) : null;
  };

  const problemFor = (field: FieldSpec): string | null => {
    const server = serverError?.errors[field.name]?.[0];
    if (server) return server;
    return touched[field.name] ? localProblem(field) : null;
  };

  const blocked = fields.some((field) => localProblem(field) !== null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(Object.fromEntries(fields.map((field) => [field.name, true])));
            if (blocked) return;
            onSubmit(values);
          }}
        >
          {fields.map((field) => {
            const id = `field-${field.name}`;
            const helpId = `${id}-help`;
            const problem = problemFor(field);
            const value = values[field.name];
            const fixed = editing && field.fixedOnEdit === true;

            return (
              <div key={field.name} className="space-y-1.5">
                {field.kind === "boolean" ? (
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={id}
                      checked={value === true}
                      onCheckedChange={(next) =>
                        setValues((current) => ({ ...current, [field.name]: next === true }))
                      }
                    />
                    <div>
                      <Label htmlFor={id}>{field.label}</Label>
                      {field.help ? (
                        <p id={helpId} className="text-xs text-muted-foreground">
                          {field.help}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <>
                    <Label htmlFor={id}>
                      {field.label}
                      {field.required ? (
                        <>
                          {" "}
                          <span aria-hidden="true">*</span>
                          <span className="sr-only">(required)</span>
                        </>
                      ) : null}
                    </Label>

                    {field.kind === "textarea" ? (
                      <Textarea
                        id={id}
                        rows={5}
                        value={typeof value === "string" ? value : ""}
                        placeholder={field.placeholder ?? ""}
                        aria-invalid={problem !== null}
                        aria-describedby={helpId}
                        onBlur={() => setTouched((t) => ({ ...t, [field.name]: true }))}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }))
                        }
                      />
                    ) : field.kind === "select" ? (
                      <Select
                        value={typeof value === "string" ? value : ""}
                        onValueChange={(next) =>
                          setValues((current) => ({ ...current, [field.name]: next }))
                        }
                      >
                        <SelectTrigger id={id} aria-describedby={helpId}>
                          <SelectValue placeholder="Choose" />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options ?? []).map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.kind === "list" ? (
                      <Input
                        id={id}
                        value={Array.isArray(value) ? value.join(", ") : ""}
                        placeholder={field.placeholder ?? "comma, separated, values"}
                        aria-invalid={problem !== null}
                        aria-describedby={helpId}
                        onBlur={() => setTouched((t) => ({ ...t, [field.name]: true }))}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.name]: event.target.value
                              .split(",")
                              .map((part) => part.trim())
                              .filter(Boolean),
                          }))
                        }
                      />
                    ) : (
                      <Input
                        id={id}
                        value={typeof value === "string" ? value : ""}
                        disabled={fixed}
                        placeholder={field.placeholder ?? ""}
                        aria-invalid={problem !== null}
                        aria-describedby={helpId}
                        onBlur={() => setTouched((t) => ({ ...t, [field.name]: true }))}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }))
                        }
                      />
                    )}

                    <p
                      id={helpId}
                      className={
                        problem ? "text-xs text-destructive" : "text-xs text-muted-foreground"
                      }
                    >
                      {problem ?? field.help ?? ""}
                    </p>
                  </>
                )}
              </div>
            );
          })}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
