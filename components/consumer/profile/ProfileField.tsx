type ProfileFieldProps = {
  label: string;
  value: string;
  labelWidth?: string;
  fullWidth?: boolean;
};

export function ProfileField({
  label,
  value,
  labelWidth = "w-[115px]",
  fullWidth = false,
}: ProfileFieldProps) {
  return (
    <div className={`flex gap-4 ${fullWidth ? "w-full" : ""}`}>
      <div className={`flex shrink-0 items-center p-2 ${labelWidth}`}>
        <span className="text-body text-black">{label}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center rounded-[var(--radius-input)] bg-white p-2">
        <span className="text-body text-text-label">{value}</span>
      </div>
    </div>
  );
}

export function ProfileFieldRow({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full flex-col gap-4 lg:flex-row">{children}</div>;
}
