import type { ReactNode } from "react";

import { cx } from "@/lib/consumer/cx";

export type CardVariant = "default" | "glass" | "tint" | "bare";

const VARIANT: Record<CardVariant, string> = {
  default: "border border-border-subtle bg-surface shadow-sm",
  /* Only over the page wash, a photo or a tint — glass on flat white is invisible. */
  glass: "glass-panel",
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
          "transition-[transform,box-shadow] duration-[200ms] ease-out can-hover:hover:-translate-y-0.5 can-hover:hover:shadow-md",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
