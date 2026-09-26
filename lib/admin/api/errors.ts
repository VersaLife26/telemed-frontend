import type { components } from "@/lib/api/schema";

/** RFC 9457 problem body. Conflicts may carry extension members such as `refundableCents`. */
export type ProblemDetails = components["schemas"]["ProblemDetails"] & Record<string, unknown>;

/**
 * Codes this console synthesises client-side for failures that never produced
 * a problem body. Every other `code` is the API's own lowercase snake_case one.
 */
export type ClientErrorCode = "network_error" | "timeout";

/**
 * One error type for the whole console.
 *
 * Anything that can fail — a server component fetch, a BFF proxy hop, a
 * TanStack Query mutation — rejects with this. Screens branch on `code` (the
 * problem's stable reason) or `status`, never on message text, and render
 * `userMessage` plus `traceId`.
 */
export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached a server. */
  readonly status: number;
  /** The problem `code`, e.g. `ip_not_allowed`. Absent on plain 401/403/404 and on validation errors. */
  readonly code: string | undefined;
  /** The problem `detail`: a human sentence written by the API. */
  readonly detail: string;
  /** Validation messages keyed by camelCase field path. */
  readonly errors: Readonly<Record<string, string[]>>;
  /** The `traceId` from the problem body. Surfaced in every toast. */
  readonly traceId: string | undefined;
  readonly body: ProblemDetails;

  constructor(status: number, body: ProblemDetails, cause?: unknown) {
    super(problemMessage(body, `Request failed (${status})`), { cause });
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.code = typeof body.code === "string" ? body.code : undefined;
    this.detail = typeof body.detail === "string" ? body.detail : "";
    this.errors = Object.freeze({ ...(body.errors ?? {}) });
    this.traceId = typeof body.traceId === "string" ? body.traceId : undefined;
  }

  /** The sentence a human should read. */
  get userMessage(): string {
    if (this.code === "ip_not_allowed") return "This network is not on the admin IP allowlist.";
    if (this.code === "network_error") return "Could not reach the API.";
    if (this.code === "timeout") return "The API did not respond in time.";
    if (this.status >= 500) return "The backend failed while handling this request.";
    const message = problemMessage(this.body, "");
    if (message) return message;
    return STATUS_MESSAGES[this.status] ?? "The request could not be completed.";
  }

  /** What, if anything, the admin can do about it. */
  get remedy(): string | undefined {
    if (this.code === "ip_not_allowed") return "Connect to the office network or the VPN, then reload.";
    if (this.code === "network_error") return "Check your connection, then reload.";
    if (this.code === "timeout") return "Try again. If it keeps timing out, quote the trace ID to support.";
    if (this.code === "concurrency_conflict") return "Reload the record and re-apply your change.";
    if (Object.keys(this.errors).length > 0) return "Correct the highlighted fields and try again.";
    switch (this.status) {
      case 401:
        return "Sign in again to continue.";
      case 403:
        return "Ask a super admin if you need this permission.";
      case 429:
        return "Wait a few seconds and try again.";
      case 503:
        return "Try again shortly.";
      default:
        return this.status >= 500 ? "Quote the trace ID when you report this." : undefined;
    }
  }

  /** True when re-issuing the same request could plausibly succeed. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }

  /** fetch() rejected: offline, DNS, TLS, connection refused. */
  static network(cause: unknown): ApiError {
    return new ApiError(
      0,
      { detail: cause instanceof Error ? cause.message : String(cause), code: "network_error" },
      cause,
    );
  }

  static timeout(timeoutMs: number, cause: unknown): ApiError {
    return new ApiError(0, { detail: `no response within ${timeoutMs}ms`, code: "timeout" }, cause);
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "Some fields need attention before this can be saved.",
  401: "Your session has ended.",
  403: "Your admin role does not permit this action.",
  404: "That record no longer exists.",
  409: "Someone else changed this record while you had it open.",
  429: "Too many requests. Slow down and try again.",
};

/** The human-readable text of a problem body: `detail`, else the first validation message, else `title`. */
export function problemMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const p = body as ProblemDetails;
  if (typeof p.detail === "string" && p.detail.trim()) return p.detail;
  if (p.errors) {
    for (const messages of Object.values(p.errors)) {
      if (messages?.[0]) return messages[0];
    }
  }
  if (typeof p.title === "string" && p.title.trim()) return p.title;
  return fallback;
}

/** Type guard usable in `catch` blocks and TanStack Query error renderers. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function hasCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}

/**
 * Maps a raw error of any kind into an ApiError. Used at every boundary where
 * an `unknown` could escape into a screen.
 */
export function toApiError(value: unknown): ApiError {
  if (isApiError(value)) return value;
  return new ApiError(0, { detail: value instanceof Error ? value.message : String(value) }, value);
}

/**
 * One-line summary suitable for a toast title, with the trace id appended
 * when there is one, so no screen has to remember to include it.
 */
export function describeForToast(error: unknown): {
  title: string;
  description: string;
} {
  const err = toApiError(error);
  const bits: string[] = [];
  if (err.remedy) bits.push(err.remedy);
  if (err.traceId) bits.push(`Trace ID ${err.traceId}`);
  const fieldNames = Object.keys(err.errors);
  if (fieldNames.length > 0) {
    bits.push(`Fields: ${fieldNames.join(", ")}`);
  }
  return {
    title: err.userMessage,
    description: bits.join(" · "),
  };
}
