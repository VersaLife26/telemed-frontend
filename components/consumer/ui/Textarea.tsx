import { cx } from "@/lib/consumer/cx";

import { Field, fieldControlClass } from "./Field";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  fieldClassName?: string;
};

export function Textarea({
  label,
  hint,
  error,
  className,
  fieldClassName,
  id,
  required,
  ...props
}: TextareaProps) {
  const control = (
    <textarea
      id={id}
      required={required}
      aria-invalid={error ? true : undefined}
      className={cx(fieldControlClass, "min-h-28 resize-y", className)}
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
