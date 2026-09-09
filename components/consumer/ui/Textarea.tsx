type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={`w-full min-h-[112px] resize-y rounded-[16px] bg-white px-6 py-3 text-[16px] font-light leading-[1.4] text-black shadow-[var(--shadow-soft)] outline-none placeholder:text-text-placeholder border border-transparent focus:border-primary-light ${className}`}
      {...props}
    />
  );
}
