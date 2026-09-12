import "server-only";

import { headers } from "next/headers";

import { serverEnv } from "@/lib/admin/env";
import type { ListEnvelope } from "./envelope";
import { ApiError } from "./errors";
import {
  ADMIN_PATH_PREFIX,
  accessTokenFor,
  forwardingHeaders,
  gatewayBaseUrl,
  ipAllowlistRejects,
} from "./gateway";
import { type RequestOptions, parseData, parseList, rawFetch } from "./http";
import { canCallApi } from "@/lib/admin/rbac";

/**
 * The API client server components use.
 *
 * Data-heavy screens — the verification queue, the audit log, the appointment
 * table — fetch here, on the server, so the first paint is already populated
 * and the browser downloads a table rather than a loading state plus a second
 * round trip. Interactive screens use `lib/api/browser.ts` through TanStack
 * Query instead.
 *
 * Both clients speak the same envelope and raise the same `ApiError`, so a
 * screen can move between them without its error handling changing.
 */

async function requestHeaders(): Promise<Headers> {
  return await headers();
}

/**
 * Performs an authenticated call to the gateway on behalf of the signed-in
 * admin. Throws `ApiError` — never returns a partial result.
 */
export async function serverFetch(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  if (!path.startsWith(`/${ADMIN_PATH_PREFIX}`)) {
    throw new ApiError({
      code: "FORBIDDEN",
      status: 0,
      serverMessage: `refusing to call a non-admin path from the console: ${path}`,
    });
  }

  const incoming = await requestHeaders();
  const source = { headers: incoming };
  const auth = await accessTokenFor(source);

  if (auth.token === null) {
    throw new ApiError({
      code: "UNAUTHORIZED",
      status: 401,
      serverMessage:
        auth.reason === "unreachable"
          ? "could not verify the caller's admin role"
          : "no cloudflare access session",
    });
  }

  // The same matrix the BFF proxy enforces, applied to server-rendered reads
  // too. A page whose group does not cover the endpoint it fetches is a bug
  // that should surface here rather than as a 403 from admin-service with no
  // indication of which of the two matrices disagreed.
  if (!canCallApi(auth.roles, path)) {
    throw new ApiError({
      code: "FORBIDDEN",
      status: 403,
      serverMessage: `the caller's admin role does not permit ${path}`,
    });
  }

  const response = await rawFetch(`${gatewayBaseUrl()}${path}`, {
    ...options,
    timeoutMs: options.timeoutMs ?? serverEnv().TELEMED_API_TIMEOUT_MS,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${auth.token}`,
      // The admin's own address, resolved from the hop in front of us and
      // never copied from the caller's own header; see `clientAddress`.
      ...forwardingHeaders(incoming),
    },
  });

  if (response.status === 403 && (await ipAllowlistRejects(source))) {
    throw new ApiError({
      code: "IP_NOT_ALLOWLISTED",
      status: 403,
      serverMessage: "the API gateway refused this network address",
      ...(response.headers.get("x-request-id")
        ? { requestId: response.headers.get("x-request-id") as string }
        : {}),
    });
  }

  return response;
}

/** GET a single resource, unwrapped to `data`. */
export async function getServer<T>(path: string, options?: RequestOptions): Promise<T> {
  return parseData<T>(await serverFetch(path, options));
}

/** GET a page, unwrapped to `{data, meta}`. */
export async function listServer<T>(
  path: string,
  options?: RequestOptions,
): Promise<ListEnvelope<T>> {
  return parseList<T>(await serverFetch(path, options));
}

/**
 * Fetches without throwing, so a page can render a partial dashboard when one
 * panel's backend is down instead of failing the whole route. The caller gets
 * the error and decides how loudly to say so.
 */
export async function tryGetServer<T>(
  path: string,
  options?: RequestOptions,
): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    return { ok: true, data: await getServer<T>(path, options) };
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof ApiError
          ? cause
          : new ApiError({
              code: "INTERNAL_ERROR",
              status: 0,
              serverMessage: cause instanceof Error ? cause.message : String(cause),
              cause,
            }),
    };
  }
}

/** List variant of `tryGetServer`. */
export async function tryListServer<T>(
  path: string,
  options?: RequestOptions,
): Promise<{ ok: true; page: ListEnvelope<T> } | { ok: false; error: ApiError }> {
  try {
    return { ok: true, page: await listServer<T>(path, options) };
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof ApiError
          ? cause
          : new ApiError({
              code: "INTERNAL_ERROR",
              status: 0,
              serverMessage: cause instanceof Error ? cause.message : String(cause),
              cause,
            }),
    };
  }
}
