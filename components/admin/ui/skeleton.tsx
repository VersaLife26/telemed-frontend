import * as React from "react";

import { cn } from "@/lib/admin/utils";

/**
 * Skeletons, not spinners.
 *
 * A spinner says "something is happening". A skeleton says "a table with six
 * columns is about to appear here", which stops the layout jumping and gives
 * the reader somewhere to look. `aria-hidden` because the surrounding region
 * carries `aria-busy` — a screen reader should hear "loading", not a
 * description of grey rectangles.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
