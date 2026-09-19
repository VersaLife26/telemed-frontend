/**
 * A read-only profile fact. Label above value rather than beside it: the
 * side-by-side form broke as soon as a label wrapped, and a fixed label column
 * cannot survive a user's larger text size.
 */
export function ProfileField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "w-full" : "min-w-0 flex-1"}>
      <dt className="text-eyebrow text-faint">{label}</dt>
      <dd className="mt-1 truncate text-body text-ink">{value || "—"}</dd>
    </div>
  );
}

export function ProfileFieldRow({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full flex-col gap-5 sm:flex-row sm:gap-8">{children}</div>;
}
