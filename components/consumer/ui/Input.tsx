type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  focused?: boolean;
};

export function Input({ focused = false, className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-[32px] bg-white px-6 py-3 text-[16px] font-light leading-[1.4] text-black shadow-[var(--shadow-soft)] outline-none placeholder:text-text-placeholder ${
        focused ? "border border-primary-light" : "border border-transparent"
      } ${className}`}
      {...props}
    />
  );
}
