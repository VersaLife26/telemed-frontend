import type { components } from "@/lib/api/schema";

/** RFC 9457 problem body. Conflicts may carry extension members such as `affectedAppointments`. */
export type ProblemDetails = components["schemas"]["ProblemDetails"] & Record<string, unknown>;

export class ApiError extends Error {
  readonly status: number;
  readonly body: ProblemDetails;

  constructor(status: number, body: ProblemDetails) {
    super(problemMessage(body, `Request failed (${status})`));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }

  get code(): string | undefined {
    return this.body.code;
  }
}

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

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function hasCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.body.code === code;
}
