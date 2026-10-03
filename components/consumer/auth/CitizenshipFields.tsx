"use client";

import { Field } from "@/components/consumer/ui/Field";
import { Input } from "@/components/consumer/ui/Input";
import { cx } from "@/lib/consumer/cx";

const OPTIONS = [
  { value: true, label: "Yes" },
  { value: false, label: "No" },
] as const;

export function CitizenshipFields({
  id,
  citizen,
  onCitizen,
  nationalId,
  onNationalId,
  hint = "Sri Lankan citizens pay the local consultation fee.",
}: {
  id: string;
  citizen: boolean | null;
  onCitizen: (value: boolean) => void;
  nationalId: string;
  onNationalId: (value: string) => void;
  hint?: string;
}) {
  const index = OPTIONS.findIndex((option) => option.value === citizen);
  return (
    <div className="flex flex-col gap-3">
      <Field label="Are you a Sri Lankan citizen?" hint={hint} htmlFor={`${id}-yes`}>
        <div
          role="radiogroup"
          aria-label="Are you a Sri Lankan citizen?"
          className="relative grid grid-cols-2 rounded-md border border-border-default bg-surface p-1"
        >
          <span
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/2)] rounded-[calc(var(--radius-md)-4px)] bg-brand-tint",
              "transition-[transform,opacity] duration-[220ms] ease-[var(--ease-out,cubic-bezier(.23,1,.32,1))]",
              index < 0 && "opacity-0",
            )}
            style={{ transform: `translateX(${Math.max(index, 0) * 100}%)` }}
          />
          {OPTIONS.map((option) => (
            <button
              key={option.label}
              id={option.value ? `${id}-yes` : `${id}-no`}
              type="button"
              role="radio"
              aria-checked={citizen === option.value}
              onClick={() => onCitizen(option.value)}
              className={cx(
                "relative min-h-10 rounded-[calc(var(--radius-md)-4px)] text-body-sm font-semibold",
                "transition-[color,transform] duration-[140ms] ease-out active:scale-[0.97]",
                citizen === option.value ? "text-brand" : "text-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Field>
      {citizen === true ? (
        <Input
          id={`${id}-nic`}
          label="National ID"
          hint="Old format 123456789V, or the 12-digit number."
          value={nationalId}
          onChange={(event) => onNationalId(event.target.value)}
          autoComplete="off"
          maxLength={20}
          required
        />
      ) : null}
    </div>
  );
}
