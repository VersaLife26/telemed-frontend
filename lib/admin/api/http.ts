import { ApiError, type ProblemDetails } from "./errors";

/**
 * The one place a `fetch` response is turned into either data or an ApiError.
 *
 * Isomorphic on purpose: the server-side client (./server.ts) and the
 * browser-side client (./browser.ts) differ only in how they resolve the URL
 * and which credentials ride along. Parsing and error mapping are identical,
 * so they live here and cannot drift.
 */

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Milliseconds; the request is aborted after this. */
  timeoutMs?: number;
  /** Next.js fetch cache directives. Server-side only; ignored in browsers. */
  next?: { revalidate?: number | false; tags?: string[] };
  cache?: RequestCache;
}

/** Performs the request and returns the raw Response, mapping only transport failures. */
export async function rawFetch(url: string, options: RequestOptions): Promise<Response> {
  const { method = "GET", body, headers = {}, timeoutMs = 15_000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const init: RequestInit & { next?: RequestOptions["next"] } = {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    signal: controller.signal,
    // Admin data is never cached by default. A screen that genuinely wants a
    // cached read passes `next: { revalidate }` explicitly.
    cache: options.cache ?? "no-store",
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (options.next) init.next = options.next;

  try {
    return await fetch(url, init);
  } catch (cause) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw ApiError.timeout(timeoutMs, cause);
    }
    throw ApiError.network(cause);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Throws an ApiError built from the problem body of a non-2xx response.
 *
 * Anything that is not a problem object (an HTML error page from a reverse
 * proxy, an empty 502) keeps its status and the start of its text, never
 * swallowed.
 */
export async function throwProblem(response: Response): Promise<never> {
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }
  const body: ProblemDetails =
    typeof parsed === "object" && parsed !== null
      ? (parsed as ProblemDetails)
      : {
          status: response.status,
          detail: text.slice(0, 300) || `${response.status} ${response.statusText || "no body"}`,
        };
  throw new ApiError(response.status, body);
}

/** Reads a response body as `T`. 204 and empty bodies read as `undefined`. */
export async function parseBody<T>(response: Response): Promise<T> {
  if (!response.ok) await throwProblem(response);
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
