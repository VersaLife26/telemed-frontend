"use client";

type OtpInputProps = {
  length?: number;
  value?: string;
  onChange?: (value: string) => void;
};

export function OtpInput({ length = 6, value = "", onChange }: OtpInputProps) {
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function updateAt(index: number, char: string) {
    const next = digits.slice();
    next[index] = char.replace(/\D/g, "").slice(-1) ?? "";
    onChange?.(next.join("").replace(/\s/g, ""));
  }

  return (
    <div className="flex w-full gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1}`}
          maxLength={1}
          value={digit}
          onChange={(e) => {
            updateAt(index, e.target.value);
            const el = e.target.nextElementSibling as HTMLInputElement | null;
            if (e.target.value && el) el.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[index] && index > 0) {
              const prev = (e.target as HTMLInputElement)
                .previousElementSibling as HTMLInputElement | null;
              prev?.focus();
            }
          }}
          className="h-14 min-w-0 flex-1 rounded-md border border-border-default bg-surface text-center text-h5 text-ink outline-none transition-[border-color,box-shadow] duration-[160ms] ease-out focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-tint)]"
        />
      ))}
    </div>
  );
}
