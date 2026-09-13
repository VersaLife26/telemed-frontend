import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/consumer/cx";

type Variant = "primary" | "secondary" | "outline";
type Size = "md" | "lg";

function buttonClass({
  variant = "primary",
  size = "md",
  fullWidth = false,
  inactive = false,
  className = "",
}: {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  inactive?: boolean;
  className?: string;
}) {
  return cx(
    "inline-flex min-h-11 items-center justify-center gap-2.5 rounded-[32px] px-6 py-3 shadow-[var(--shadow-soft)] transition-[transform,opacity] duration-[120ms] ease-[var(--ease-out)]",
    "active:scale-[0.97]",
    variant === "primary" && "bg-primary text-[16px] font-bold leading-[1.4] text-white",
    variant === "secondary" && "bg-linen text-[16px] font-medium leading-[1.4] text-ink",
    variant === "outline" &&
      "border border-border bg-paper text-[16px] font-medium leading-[1.4] text-text-muted",
    size === "lg" && "py-3 text-[18px] font-semibold tracking-[-0.02em]",
    fullWidth ? "w-full" : "w-auto",
    inactive ? "cursor-not-allowed opacity-60" : "cursor-pointer",
    className,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  busy?: boolean;
  icon?: string;
  iconAlt?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  busy = false,
  icon,
  iconAlt = "",
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const inactive = Boolean(disabled || busy);

  return (
    <button
      type={type}
      className={buttonClass({ variant, size, fullWidth, inactive, className })}
      disabled={inactive}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? (
        <span
          className="size-[18px] shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : icon ? (
        <span className="relative size-[18px] shrink-0 overflow-hidden">
          <Image src={icon} alt={iconAlt} fill className="object-contain" />
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClass({ variant, size, fullWidth, className })}>
      {children}
    </Link>
  );
}
