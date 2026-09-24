"use client";

import { Field } from "@/components/consumer/ui/Field";
import type { Sex } from "@/lib/consumer/api/types";
import { cx } from "@/lib/consumer/cx";

const OPTIONS: { value: Sex; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

export function SexField({
  id,
  label = "Sex",
  value,
  onChange,
  disabled,
  hint,
}: {
  id: string;
  label?: string;
  value: Sex | "";
  onChange: (value: Sex | "") => void;
  disabled?: boolean;
  hint?: string;
}) {
  const index = OPTIONS.findIndex((o) => o.value === value);
  return (
    <Field label={label} hint={hint} htmlFor={`${id}-${OPTIONS[0]!.value}`}>
      <div
        role="radiogroup"
        aria-label={label}
        className="relative grid grid-cols-3 rounded-md border border-border-default bg-surface p-1"
      >
        <span
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-[calc(var(--radius-md)-4px)] bg-brand-tint",
            "transition-[transform,opacity] duration-[220ms] ease-[var(--ease-out,cubic-bezier(.23,1,.32,1))]",
            index < 0 && "opacity-0",
          )}
          style={{ transform: `translateX(${Math.max(index, 0) * 100}%)` }}
        />
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            id={`${id}-${o.value}`}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={disabled}
            onClick={() => onChange(value === o.value ? "" : o.value)}
            className={cx(
              "relative min-h-10 rounded-[calc(var(--radius-md)-4px)] text-body-sm font-semibold",
              "transition-[color,transform] duration-[140ms] ease-out active:scale-[0.97]",
              "disabled:cursor-not-allowed disabled:opacity-60",
              value === o.value ? "text-brand" : "text-muted",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}
