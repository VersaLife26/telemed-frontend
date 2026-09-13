type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  focused?: boolean;
};

export function Input({ focused = false, className = "", ...props }: InputProps) {
  return (
    <input
      className={`min-h-12 w-full rounded-[32px] bg-paper px-6 py-3 text-[16px] leading-[1.4] text-ink shadow-[var(--shadow-soft)] outline-none placeholder:text-text-placeholder ${
        focused ? "border border-primary-light" : "border border-transparent"
      } ${className}`}
      {...props}
    />
  );
}
