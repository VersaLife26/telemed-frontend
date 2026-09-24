import { cx } from "@/lib/consumer/cx";

import { Field, fieldControlClass } from "./Field";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** A Lucide icon, rendered inside the field on the leading edge. */
  icon?: React.ReactNode;
  fieldClassName?: string;
};

export function Input({
  label,
  hint,
  error,
  icon,
  className,
  fieldClassName,
  id,
  required,
  ...props
}: InputProps) {
  const control = icon ? (
    <span
      className={cx(
        fieldControlClass,
        "flex items-center gap-2.5 py-0 focus-within:border-brand focus-within:shadow-[0_0_0_4px_var(--brand-tint)] can-hover:focus-within:border-brand",
        className,
      )}
    >
      <span className="shrink-0 text-faint" aria-hidden="true">
        {icon}
      </span>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        className="min-h-11 w-full min-w-0 border-none bg-transparent text-body text-inherit outline-none placeholder:text-faint"
        {...props}
      />
    </span>
  ) : (
    <input
      id={id}
      required={required}
      aria-invalid={error ? true : undefined}
      className={cx(fieldControlClass, "min-h-11", className)}
      {...props}
    />
  );

  if (!label && !hint && !error) return control;

  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} required={required} className={fieldClassName}>
      {control}
    </Field>
  );
}
