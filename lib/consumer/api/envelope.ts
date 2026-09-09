export type ApiErrorBody = {
  code?: string;
  message?: string;
  fields?: Record<string, string>;
  request_id?: string;
};

export type ApiSuccess<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function parseEnvelope<T>(json: unknown): T {
  if (json && typeof json === "object" && "data" in json) {
    return (json as ApiSuccess<T>).data;
  }
  return json as T;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
