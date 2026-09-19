import { twMerge } from "tailwind-merge";

/**
 * Join class names, letting a later one win over an earlier one that sets the
 * same Tailwind property. Without the merge a `className` passed into a
 * primitive loses to that primitive's own base classes -- silently, because
 * both end up in the stylesheet and source order decides.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(" "));
}
