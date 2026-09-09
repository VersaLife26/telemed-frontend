import Link from "next/link";

import { cn } from "@/lib/admin/utils";

/**
 * Server-side date range control.
 *
 * Uses plain links instead of `useSearchParams`, so the dashboard never
 * suspends behind a client-only search-params boundary — which in Next.js 16
 * leaves the whole `(console)` segment stuck on `loading.tsx` until hydration.
 */
export function RangePickerLinks({
  current,
  options,
}: {
  current: number;
  options: readonly number[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Date range"
      className="inline-flex items-center gap-1 rounded-lg border border-border p-1"
    >
      {options.map((days) => {
        const active = days === current;
        const href = days === 30 ? "/" : `/?days=${days}`;
        return (
          <Link
            key={days}
            href={href}
            role="radio"
            aria-checked={active}
            className={cn(
              "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {days} days
          </Link>
        );
      })}
    </div>
  );
}
