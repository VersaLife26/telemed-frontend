"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/admin/ui/button";

/**
 * Date-range control, in one row above the charts.
 *
 * A radio group rather than a dropdown: there are three options, they are
 * mutually exclusive, and which one is active should be visible without
 * opening anything.
 */
export function RangePicker({
  current,
  options,
}: {
  current: number;
  options: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (days: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (days === 30) params.delete("days");
    else params.set("days", String(days));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Date range"
      className="inline-flex items-center gap-1 rounded-lg border border-border p-1"
    >
      {options.map((days) => (
        <Button
          key={days}
          role="radio"
          aria-checked={days === current}
          variant={days === current ? "secondary" : "ghost"}
          size="sm"
          onClick={() => select(days)}
        >
          {days} days
        </Button>
      ))}
    </div>
  );
}
