import {
  type ApiErrorCode,
  type ErrorEnvelope,
  isKnownErrorCode,
} from "./envelope";

/**
 * One error type for the whole console.
 *
 * Anything that can fail — a server component fetch, a BFF proxy hop, a
 * TanStack Query mutation — rejects with this. Screens never inspect HTTP
 * status codes or parse error strings; they switch on `code`, and they render
 * `userMessage` plus `requestId`.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** HTTP status, or 0 when the request never reached a server. */
  readonly status: number;
  /** Field-level validation detail, keyed by the JSON field name. */
  readonly fields: Readonly<Record<string, string>>;
  /** The `request_id` from the error envelope. Surfaced in every toast. */
  readonly requestId: string | undefined;
  /** Raw backend message, kept for the details disclosure and for logging. */
  readonly serverMessage: string;

  constructor(init: {
    code: ApiErrorCode;
    status: number;
    serverMessage: string;
    fields?: Record<string, string>;
    requestId?: string;
    cause?: unknown;
  }) {
    super(`${init.code}: ${init.serverMessage}`, { cause: init.cause });
    this.name = "ApiError";
    this.code = init.code;
    this.status = init.status;
    this.serverMessage = init.serverMessage;
    this.fields = Object.freeze({ ...(init.fields ?? {}) });
    this.requestId = init.requestId;
  }

  /** The sentence a human should read. */
  get userMessage(): string {
    return USER_MESSAGES[this.code];
  }

  /** What, if anything, the admin can do about it. */
  get remedy(): string | undefined {
    return REMEDIES[this.code];
  }

  /** True when re-issuing the same request could plausibly succeed. */
  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }

  /** Builds an ApiError from a parsed error envelope. */
  static fromEnvelope(body: ErrorEnvelope, status: number): ApiError {
    const code: ApiErrorCode = isKnownErrorCode(body.code)
      ? body.code
      : // An unrecognised code means the backend grew one this build does not
        // know about. Degrade to INTERNAL_ERROR rather than crash, but keep
        // the real code in the message so the report is still actionable.
        "INTERNAL_ERROR";
    const init: {
      code: ApiErrorCode;
      status: number;
      serverMessage: string;
      fields?: Record<string, string>;
      requestId?: string;
    } = {
      code,
      status,
      serverMessage: isKnownErrorCode(body.code)
        ? body.message
        : `${body.code}: ${body.message}`,
    };
    if (body.fields) init.fields = body.fields;
    if (body.request_id) init.requestId = body.request_id;
    return new ApiError(init);
  }

  /** fetch() rejected: offline, DNS, TLS, connection refused. */
  static network(cause: unknown): ApiError {
    return new ApiError({
      code: "NETWORK_ERROR",
      status: 0,
      serverMessage: cause instanceof Error ? cause.message : String(cause),
      cause,
    });
  }
}

/** Type guard usable in `catch` blocks and TanStack Query error renderers. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/**
 * The central code → message map the brief calls for.
 *
 * Rules these messages follow: say what happened from the admin's point of
 * view, never leak backend vocabulary ("pgx", "JWKS", "outbox"), and never
 * blame the user for something the system did.
 */
const USER_MESSAGES: Record<ApiErrorCode, string> = {
  BAD_REQUEST: "The console sent something this endpoint could not read.",
  VALIDATION_FAILED: "Some fields need attention before this can be saved.",
  UNAUTHORIZED: "Your session has ended.",
  FORBIDDEN: "Your admin role does not permit this action.",
  NOT_FOUND: "That record no longer exists.",
  CONFLICT: "Someone else changed this record while you had it open.",
  SLOT_UNAVAILABLE: "That appointment slot is no longer available.",
  SLOT_LOCKED: "Another booking is being processed for that slot right now.",
  RATE_LIMITED: "Too many requests. The gateway is throttling this client.",
  PAYMENT_REQUIRED: "This action requires a completed payment on the appointment.",
  UNPROCESSABLE: "The request was understood but cannot be applied in this state.",
  INTERNAL_ERROR: "The backend failed while handling this request.",
  SERVICE_UNAVAILABLE: "That backend service is not accepting requests right now.",
  TIMEOUT: "The backend did not respond in time.",
  IP_NOT_ALLOWLISTED: "This network is not on the admin IP allowlist.",
  NETWORK_ERROR: "Could not reach the API gateway.",
  MALFORMED_RESPONSE: "The backend returned a response this console cannot read.",
};

const REMEDIES: Partial<Record<ApiErrorCode, string>> = {
  UNAUTHORIZED: "Sign in again to continue.",
  FORBIDDEN: "Ask a super_admin if you need this permission.",
  CONFLICT: "Reload the record and re-apply your change.",
  VALIDATION_FAILED: "Correct the highlighted fields and try again.",
  RATE_LIMITED: "Wait a few seconds and try again.",
  SERVICE_UNAVAILABLE: "Try again shortly; if it persists, check the service health dashboard.",
  TIMEOUT: "Try again. If it keeps timing out, quote the request ID to support.",
  IP_NOT_ALLOWLISTED: "Connect to the office network or the VPN, then reload.",
  NETWORK_ERROR: "Check your connection, then reload.",
  INTERNAL_ERROR: "Quote the request ID when you report this.",
  MALFORMED_RESPONSE: "Quote the request ID when you report this.",
};

const RETRYABLE: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "TIMEOUT",
  "NETWORK_ERROR",
  "INTERNAL_ERROR",
]);

/**
 * Maps a raw error of any kind into an ApiError. Used at every boundary where
 * an `unknown` could escape into a screen.
 */
export function toApiError(value: unknown): ApiError {
  if (isApiError(value)) return value;
  return new ApiError({
    code: "INTERNAL_ERROR",
    status: 0,
    serverMessage: value instanceof Error ? value.message : String(value),
    cause: value,
  });
}

/**
 * One-line summary suitable for a toast title, with the request id appended
 * when there is one. Toast bodies use `describeForToast` so no screen has to
 * remember to include the request id — the thing that makes a support ticket
 * actionable is not left to whoever wrote that particular call site.
 */
export function describeForToast(error: unknown): {
  title: string;
  description: string;
} {
  const err = toApiError(error);
  const bits: string[] = [];
  if (err.remedy) bits.push(err.remedy);
  if (err.requestId) bits.push(`Request ID ${err.requestId}`);
  const fieldNames = Object.keys(err.fields);
  if (fieldNames.length > 0) {
    bits.push(`Fields: ${fieldNames.join(", ")}`);
  }
  return {
    title: err.userMessage,
    description: bits.join(" · "),
  };
}
