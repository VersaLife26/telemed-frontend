import type { ReactNode } from "react";

import { cx } from "@/lib/consumer/cx";

export type CardVariant = "default" | "solid" | "glass" | "glass-thin" | "glass-thick" | "glass-dark" | "tint" | "bare";

const VARIANT: Record<CardVariant, string> = {
  default: "border border-white/60 surface-frost",
  solid: "border border-border-subtle bg-surface shadow-sm",
  /* Only over the ambient field, a photo or a tint — glass on flat white is invisible. */
  glass: "glass-regular",
  "glass-thin": "glass-thin",
  "glass-thick": "glass-thick",
  "glass-dark": "glass-dark",
  tint: "border border-blue-200 bg-tint",
  bare: "bg-transparent",
};

/**
 * The one card in the consumer surfaces. Patient and doctor used to carry two
 * different ones, which is how the two surfaces drifted apart without anyone
 * deciding to.
 */
export function Card({
  children,
  className,
  variant = "default",
  interactive = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
  /** Adds hover lift + shadow. For a card that is itself a link or a button. */
  interactive?: boolean;
  as?: "div" | "article" | "section" | "li";
}) {
  return (
    <Tag
      className={cx(
        "rounded-lg p-6",
        VARIANT[variant],
        interactive &&
          "transition-[translate,scale,box-shadow] duration-[var(--dur-fast)] ease-out can-hover:hover:-translate-y-0.5 can-hover:hover:shadow-md active:scale-[0.99]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
