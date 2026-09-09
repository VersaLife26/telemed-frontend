/**
 * The platform response envelope, as defined in _shared/AGENT-BRIEF.md §3 and
 * implemented in every Go service's `internal/platform/httpx`.
 *
 * Success: {"data": ...} or {"data": [...], "meta": {...}}
 * Error:   {"code": "...", "message": "...", "fields": {...}, "request_id": "..."}
 *
 * These two shapes are the only contract ten backend services and this console
 * share. Everything else in lib/api is built on top of them.
 */

/** Pagination metadata, present on list endpoints only. */
export interface Meta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

/** Successful single-resource response. */
export interface Envelope<T> {
  data: T;
  meta?: Meta;
}

/** Successful list response. `meta` is guaranteed. */
export interface ListEnvelope<T> {
  data: T[];
  meta: Meta;
}

/**
 * Error body. `request_id` is the field that turns "it broke" into a support
 * ticket someone can actually action — it correlates this response with the
 * gateway log line, the service log line and the OTel trace.
 */
export interface ErrorEnvelope {
  code: string;
  message: string;
  fields?: Record<string, string>;
  request_id?: string;
}

/**
 * Every error code `httpx.ErrorCode` currently defines, plus the two this
 * console synthesises client-side. Kept as a union rather than a bare string
 * so adding a code to the backend and forgetting to give it a message here is
 * a type error, not a silent fallback to "Something went wrong".
 */
export const API_ERROR_CODES = [
  "BAD_REQUEST",
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "SLOT_UNAVAILABLE",
  "SLOT_LOCKED",
  "RATE_LIMITED",
  "PAYMENT_REQUIRED",
  "UNPROCESSABLE",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
  "TIMEOUT",
  // --- synthesised by this client, never sent by a backend -----------------
  /** The gateway's IP allowlist refused us. See lib/api/ip-allowlist.ts. */
  "IP_NOT_ALLOWLISTED",
  /** fetch() itself failed: DNS, TLS, connection refused, offline. */
  "NETWORK_ERROR",
  /** A 2xx body that did not parse as the platform envelope. */
  "MALFORMED_RESPONSE",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

const CODE_SET: ReadonlySet<string> = new Set(API_ERROR_CODES);

export function isKnownErrorCode(code: string): code is ApiErrorCode {
  return CODE_SET.has(code);
}

/** Narrowing guard for an error body arriving as `unknown` from JSON.parse. */
export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" && typeof v.message === "string";
}

/** Narrowing guard for a success body. */
export function isEnvelope(value: unknown): value is Envelope<unknown> {
  return typeof value === "object" && value !== null && "data" in value;
}

/** An empty page, for the many list screens that render before first fetch. */
export function emptyMeta(perPage = 25): Meta {
  return { page: 1, per_page: perPage, total: 0, total_pages: 0 };
}
