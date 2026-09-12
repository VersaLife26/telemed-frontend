import type { ListEnvelope } from "./envelope";
import { type RequestOptions, parseData, parseList, rawFetch } from "./http";

/**
 * The API client browser code uses.
 *
 * It talks to the BFF at `/api/gateway/...` on the same origin — never to the
 * API gateway directly. Two consequences, both deliberate: the bearer
 * token stays server-side, and the CSP can keep `connect-src 'self'`.
 *
 * The path passed in is the real platform path (`/api/v1/admin/...`) so that
 * `lib/api/endpoints.ts` is shared verbatim with the server client; the
 * rewrite to the proxy prefix happens here and nowhere else.
 */

const PROXY_PREFIX = "/api/gateway";

export function proxyUrl(path: string): string {
  return `${PROXY_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function browserFetch(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  return rawFetch(proxyUrl(path), options);
}

/** GET a single resource, unwrapped to `data`. */
export async function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return parseData<T>(await browserFetch(path, options));
}

/** GET a page, unwrapped to `{data, meta}`. */
export async function list<T>(
  path: string,
  options?: RequestOptions,
): Promise<ListEnvelope<T>> {
  return parseList<T>(await browserFetch(path, options));
}

/** POST/PUT/PATCH/DELETE returning `data`. */
export async function send<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const init: RequestOptions = { ...options, method };
  if (body !== undefined) init.body = body;
  return parseData<T>(await browserFetch(path, init));
}

/**
 * Streams a file download (CSV export) through the proxy.
 *
 * The published-artifact style `<a download>` trick is not used: the response
 * is fetched, turned into an object URL, clicked and revoked, so a failure
 * surfaces as an ApiError toast with a request id rather than as a browser
 * tab showing a JSON error body.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await browserFetch(path, { headers: { Accept: "text/csv" } });
  if (!response.ok) {
    // Reuse the envelope parser purely for its error mapping; it throws.
    await parseData<never>(response);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
