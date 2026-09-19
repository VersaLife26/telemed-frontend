import type { ReactNode } from "react";

import { cx } from "@/lib/consumer/cx";

/**
 * The shared chrome for every text-entry control: one border radius, one
 * border colour, one focus treatment. Input, Select and Textarea all sit in
 * it, which is what keeps a form from looking assembled out of spare parts.
 */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  required = false,
  className,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-label text-ink">
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-body-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-body-sm text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

/** Shared by Input, Select and Textarea so the three cannot drift. */
export const fieldControlClass = cx(
  "w-full rounded-md border border-border-default bg-surface px-4 py-3 text-body text-ink",
  "outline-none transition-[border-color,box-shadow] duration-[160ms] ease-out",
  "placeholder:text-faint",
  "focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-tint)]",
  "disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-faint",
  "aria-[invalid=true]:border-danger",
);
