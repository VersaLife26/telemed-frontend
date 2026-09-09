import {
  type Envelope,
  type ListEnvelope,
  type Meta,
  isEnvelope,
  isErrorEnvelope,
} from "./envelope";
import { ApiError } from "./errors";

/**
 * The one place a `fetch` response is turned into either data or an ApiError.
 *
 * Isomorphic on purpose: the server-side client (lib/api/server.ts) and the
 * browser-side client (lib/api/browser.ts) differ only in how they resolve the
 * URL and where the bearer token comes from. Parsing and error mapping are
 * identical, so they live here and cannot drift.
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
      throw new ApiError({
        code: "TIMEOUT",
        status: 0,
        serverMessage: `no response within ${timeoutMs}ms`,
        cause,
      });
    }
    throw ApiError.network(cause);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads a response as the platform envelope.
 *
 * Non-2xx bodies must be an `{code, message, ...}` error envelope; anything
 * else (an HTML error page from a reverse proxy, an empty 502) is reported as
 * INTERNAL_ERROR with the status preserved, never swallowed.
 */
export async function parseEnvelope<T>(response: Response): Promise<Envelope<T>> {
  const text = await response.text();

  let parsed: unknown = undefined;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  if (!response.ok) {
    if (isErrorEnvelope(parsed)) {
      throw ApiError.fromEnvelope(parsed, response.status);
    }
    throw new ApiError({
      code: statusFallbackCode(response.status),
      status: response.status,
      serverMessage:
        text.slice(0, 300) || `${response.status} ${response.statusText || "no body"}`,
      // A gateway that fell over before reaching a service still sets the
      // request id header; without it the operator has nothing to search on.
      ...headerRequestId(response),
    });
  }

  // 204 and friends.
  if (response.status === 204 || text.length === 0) {
    return { data: undefined as T };
  }

  if (!isEnvelope(parsed)) {
    throw new ApiError({
      code: "MALFORMED_RESPONSE",
      status: response.status,
      serverMessage: `expected {data}, got ${text.slice(0, 120)}`,
      ...headerRequestId(response),
    });
  }

  return parsed as Envelope<T>;
}

/** Unwraps to `data`, discarding pagination. */
export async function parseData<T>(response: Response): Promise<T> {
  return (await parseEnvelope<T>(response)).data;
}

/** Unwraps to `{data, meta}`, synthesising `meta` if a backend omitted it. */
export async function parseList<T>(response: Response): Promise<ListEnvelope<T>> {
  const envelope = await parseEnvelope<T[]>(response);
  const data = Array.isArray(envelope.data) ? envelope.data : [];
  const meta: Meta = envelope.meta ?? {
    page: 1,
    per_page: data.length,
    total: data.length,
    total_pages: data.length > 0 ? 1 : 0,
  };
  return { data, meta };
}

function headerRequestId(response: Response): { requestId?: string } {
  const id = response.headers.get("X-Request-ID");
  return id ? { requestId: id } : {};
}

function statusFallbackCode(status: number) {
  switch (status) {
    case 400:
      return "BAD_REQUEST" as const;
    case 401:
      return "UNAUTHORIZED" as const;
    case 403:
      return "FORBIDDEN" as const;
    case 404:
      return "NOT_FOUND" as const;
    case 409:
      return "CONFLICT" as const;
    case 422:
      return "UNPROCESSABLE" as const;
    case 429:
      return "RATE_LIMITED" as const;
    case 503:
      return "SERVICE_UNAVAILABLE" as const;
    case 504:
      return "TIMEOUT" as const;
    default:
      return "INTERNAL_ERROR" as const;
  }
}
