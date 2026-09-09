/** Build FilterBar `values` from a page's searchParams and its filter specs. */
export function filterValues(
  params: Record<string, string | undefined>,
  filters: readonly { name: string }[],
): Record<string, string> {
  return Object.fromEntries(filters.map((f) => [f.name, params[f.name] ?? ""]));
}

/** Serialize current page searchParams for Pagination (includes `page`). */
export function pageQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  return qs.toString();
}
