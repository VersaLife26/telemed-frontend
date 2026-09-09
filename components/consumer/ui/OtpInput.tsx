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
    next[index] = char.replace(/\D/g, "").slice(-1);
    onChange?.(next.join("").replace(/\s/g, ""));
  }

  return (
    <div className="flex w-full gap-3 sm:gap-4">
      {digits.map((digit, index) => (
        <input
          key={index}
          inputMode="numeric"
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
          className="h-[46px] min-w-0 flex-1 rounded-[16px] border border-border-input bg-white text-center text-[16px] font-medium text-black shadow-[var(--shadow-otp)] outline-none focus:border-primary-light"
        />
      ))}
    </div>
  );
}
