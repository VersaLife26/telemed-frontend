"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import type { Meta } from "@/lib/admin/api/envelope";
import { formatCount } from "@/lib/admin/format";

/**
 * Pagination driven by the URL, not by component state.
 *
 * The current query string is passed from the server page so this never calls
 * `useSearchParams` (which suspends behind a skeleton that can stick forever
 * under Next.js 16).
 */
export function Pagination({
  meta,
  label,
  query,
}: {
  meta: Meta;
  label: string;
  /** Current URL query string from the server page (may include `page`). */
  query: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const goTo = (page: number) => {
    const params = new URLSearchParams(query);
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const totalPages = Math.max(1, meta.total_pages);
  const first = meta.total === 0 ? 0 : (meta.page - 1) * meta.per_page + 1;
  const last = Math.min(meta.page * meta.per_page, meta.total);

  return (
    <nav
      aria-label={`${label} pagination`}
      className="flex flex-wrap items-center justify-between gap-3 py-3"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {meta.total === 0
          ? "No results"
          : `Showing ${formatCount(first)}–${formatCount(last)} of ${formatCount(meta.total)}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => goTo(meta.page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          Page {meta.page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= totalPages}
          onClick={() => goTo(meta.page + 1)}
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
