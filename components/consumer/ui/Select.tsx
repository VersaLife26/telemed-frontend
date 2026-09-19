import { ChevronDown } from "lucide-react";

import { cx } from "@/lib/consumer/cx";

import { Field, fieldControlClass } from "./Field";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  fieldClassName?: string;
};

/**
 * A native <select>, deliberately. The doctor directory's filters are a GET
 * form that has to work before -- and without -- JavaScript, and a native
 * control is also the one that gets the platform's own picker on mobile.
 */
export function Select({
  label,
  hint,
  error,
  className,
  fieldClassName,
  id,
  required,
  children,
  ...props
}: SelectProps) {
  const control = (
    <span className="relative block">
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cx(fieldControlClass, "min-h-11 cursor-pointer appearance-none pr-10", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
      />
    </span>
  );

  if (!label && !hint && !error) return control;

  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} required={required} className={fieldClassName}>
      {control}
    </Field>
  );
}
