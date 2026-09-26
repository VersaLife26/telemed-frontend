import { type RequestOptions, parseBody, rawFetch, throwProblem } from "./http";
import type { Paged } from "./types";

/**
 * The API client browser code uses.
 *
 * It talks to the BFF at `/api/gateway/...` on the same origin — never to the
 * API directly. Two consequences, both deliberate: the Access token is only
 * attached server-side, and the CSP can keep `connect-src 'self'`.
 *
 * The path passed in is the real platform path (`/api/v1/admin/...`) so that
 * `./endpoints.ts` is shared verbatim with the server client; the rewrite to
 * the proxy prefix happens here and nowhere else.
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

/** GET a resource. */
export async function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return parseBody<T>(await browserFetch(path, options));
}

/** GET a page: `{items, page, pageSize, total}`. */
export async function list<T>(path: string, options?: RequestOptions): Promise<Paged<T>> {
  return get<Paged<T>>(path, options);
}

/** POST/PUT/PATCH/DELETE returning the response body. */
export async function send<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const init: RequestOptions = { ...options, method };
  if (body !== undefined) init.body = body;
  return parseBody<T>(await browserFetch(path, init));
}

/**
 * Streams a file download (CSV export) through the proxy.
 *
 * The response is fetched, turned into an object URL, clicked and revoked, so
 * a failure surfaces as an ApiError toast with a trace id rather than as a
 * browser tab showing a JSON error body.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await browserFetch(path, { headers: { Accept: "text/csv" } });
  if (!response.ok) await throwProblem(response);
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
