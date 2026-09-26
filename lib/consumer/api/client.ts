import { API_BASE_URL } from "@/lib/consumer/env";
import { ApiError, type ProblemDetails } from "@/lib/consumer/api/errors";

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
};

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method || (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { detail: text };
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, (json as ProblemDetails) || { title: res.statusText });
  }

  return json as T;
}

/** Browser-side helper: goes through same-origin BFF so cookies attach the JWT. */
let browserRefresh: Promise<boolean> | null = null;

function refreshBrowserSession(): Promise<boolean> {
  if (!browserRefresh) {
    browserRefresh = fetch("/api/auth/refresh", { method: "POST", cache: "no-store" })
      .then((res) => res.ok)
      .finally(() => {
        browserRefresh = null;
      });
  }
  return browserRefresh;
}

export async function browserApi<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  const send = () =>
    fetch(`/api/proxy${path.startsWith("/") ? path : `/${path}`}`, {
      method: options.method || (options.body !== undefined ? "POST" : "GET"),
      headers: options.body !== undefined && !isForm ? { "Content-Type": "application/json" } : undefined,
      body:
        options.body === undefined
          ? undefined
          : isForm
            ? (options.body as FormData)
            : JSON.stringify(options.body),
      cache: "no-store",
    });

  let res = await send();
  if (res.status === 401) {
    const refreshed = await refreshBrowserSession();
    if (refreshed) res = await send();
  }
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { detail: text };
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, (json as ProblemDetails) || { title: res.statusText });
  }
  if (!text) {
    return undefined as T;
  }
  return json as T;
}
