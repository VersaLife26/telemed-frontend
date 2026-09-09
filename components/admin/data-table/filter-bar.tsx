"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSpec {
  /** Query-string key. */
  name: string;
  label: string;
  kind: "search" | "select" | "date";
  options?: FilterOption[];
  placeholder?: string;
}

/**
 * URL-driven filters.
 *
 * Values come from the server page's `searchParams` so this component never
 * calls `useSearchParams`. In Next.js 16 that hook suspends behind a local
 * Suspense fallback that can stay painted forever; driving state from the
 * server (same pattern as RangePickerLinks) is what makes the bar render.
 */
export function FilterBar({
  filters,
  legend,
  values,
}: {
  filters: readonly FilterSpec[];
  legend: string;
  /** Current query values from the server page. */
  values: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const formRef = React.useRef<HTMLFormElement>(null);

  const applied = filters.filter((f) => (values[f.name] ?? "") !== "");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const filter of filters) {
      const value = data.get(filter.name);
      if (typeof value === "string" && value !== "" && value !== "__all__") {
        params.set(filter.name, value);
      }
    }
    // A new filter means a new result set; staying on page 7 of the old one is
    // never what anybody wanted.
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const clear = () => router.push(pathname);

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="mb-4 rounded-lg border border-border bg-card p-4"
    >
      <fieldset className="space-y-3">
        <legend className="sr-only">{legend}</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filters.map((filter) => {
            const id = `filter-${filter.name}`;
            const current = values[filter.name] ?? "";
            return (
              <div key={filter.name} className="space-y-1.5">
                <Label htmlFor={id}>{filter.label}</Label>
                {filter.kind === "select" ? (
                  <Select name={filter.name} defaultValue={current || "__all__"}>
                    <SelectTrigger id={id}>
                      <SelectValue placeholder={filter.placeholder ?? "Any"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Any</SelectItem>
                      {(filter.options ?? []).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={id}
                    name={filter.name}
                    type={filter.kind === "date" ? "date" : "search"}
                    defaultValue={current}
                    placeholder={filter.placeholder ?? ""}
                    // A named autocomplete token would let the browser offer
                    // an admin's own address book against a patient search box.
                    autoComplete="off"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm">
            <Search className="size-4" aria-hidden="true" />
            Apply filters
          </Button>
          {applied.length > 0 ? (
            <Button type="button" size="sm" variant="ghost" onClick={clear}>
              <X className="size-4" aria-hidden="true" />
              Clear {applied.length} filter{applied.length === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}
