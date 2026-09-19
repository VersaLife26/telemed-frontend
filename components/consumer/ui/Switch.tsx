"use client";

import { cx } from "@/lib/consumer/cx";

/**
 * A checkbox styled as a switch, rather than a div with role="switch": the
 * native control already carries the label association, the keyboard
 * behaviour and the form value.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  name,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  name?: string;
  className?: string;
}) {
  return (
    <label
      className={cx(
        "flex min-h-11 cursor-pointer items-center justify-between gap-4",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-body font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-body-sm text-muted">{description}</span>
        ) : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 m-0 cursor-[inherit] opacity-0"
        />
        <span
          aria-hidden="true"
          className={cx(
            "flex h-7 w-12 items-center rounded-pill p-0.5 transition-colors duration-[160ms] ease-out",
            "peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
            checked ? "bg-brand" : "bg-ink-200",
          )}
        >
          <span
            className={cx(
              "size-6 rounded-full bg-white shadow-sm transition-transform duration-[160ms] ease-out",
              checked ? "translate-x-5" : "translate-x-0",
            )}
          />
        </span>
      </span>
    </label>
  );
}
