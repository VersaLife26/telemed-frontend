import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { cx } from "@/lib/consumer/cx";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "glass" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-9 gap-1.5 px-4 text-[0.8125rem]",
  md: "min-h-11 gap-2 px-6 text-[0.9375rem]",
  lg: "min-h-12 gap-2.5 px-8 text-[1rem]",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-[image:var(--gradient-cta)] text-on-brand shadow-brand can-hover:hover:brightness-[1.06]",
  secondary: "bg-brand-tint text-brand can-hover:hover:bg-blue-200",
  outline:
    "border border-border-default bg-surface text-ink shadow-sm can-hover:hover:border-border-strong",
  ghost: "text-muted can-hover:hover:bg-tint can-hover:hover:text-ink",
  glass: "glass-panel text-ink can-hover:hover:bg-[var(--glass-bg-medium)]",
  danger: "bg-danger text-white shadow-sm can-hover:hover:brightness-110",
};

/**
 * Press feedback is the point: `active:scale-[0.97]` fires on pointer-down, so
 * the control answers before the handler does. Hover is a 1px lift and lives
 * behind `can-hover:` -- on a touch screen it would stick after the tap.
 *
 * Only transform, box-shadow, colour and filter transition. `transition-all`
 * would animate layout properties too, off the compositor.
 */
function buttonClass({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}) {
  return cx(
    "inline-flex cursor-pointer select-none items-center justify-center rounded-pill font-semibold leading-none",
    "transition-[transform,box-shadow,background-color,border-color,color,filter] duration-[160ms] ease-out",
    "can-hover:hover:-translate-y-px active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    SIZE[size],
    VARIANT[variant],
    fullWidth ? "w-full" : "w-auto",
    className,
  );
}

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  busy?: boolean;
  /** Path to an SVG/PNG in /public. For a Lucide component use `leading`. */
  icon?: string;
  iconAlt?: string;
  /** Rendered before the label — a Lucide icon, a dot, an avatar. */
  leading?: ReactNode;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  busy = false,
  icon,
  iconAlt = "",
  leading,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, fullWidth, className })}
      disabled={Boolean(disabled || busy)}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? (
        <span
          className="size-[1.125rem] shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : icon ? (
        <span className="relative size-[1.125rem] shrink-0 overflow-hidden">
          <Image src={icon} alt={iconAlt} fill className="object-contain" />
        </span>
      ) : (
        leading
      )}
      {children}
    </button>
  );
}

type ButtonLinkProps = Omit<React.ComponentPropsWithoutRef<typeof Link>, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leading?: ReactNode;
  children?: ReactNode;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  leading,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, fullWidth, className })} {...props}>
      {leading}
      {children}
    </Link>
  );
}
