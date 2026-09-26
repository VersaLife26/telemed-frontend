import "server-only";

import { headers } from "next/headers";

import { serverEnv } from "@/lib/admin/env";
import { accessHeaders } from "@/lib/admin/auth/access";
import { ApiError, toApiError } from "./errors";
import { ADMIN_PATH_PREFIX, accessTokenFor, forwardingHeaders, gatewayBaseUrl } from "./gateway";
import { type RequestOptions, parseBody, rawFetch } from "./http";
import type { Paged } from "./types";
import { canCallApi } from "@/lib/admin/rbac";

/**
 * The API client server components use.
 *
 * Data-heavy screens — the verification queue, the audit log, the appointment
 * table — fetch here, on the server, so the first paint is already populated
 * and the browser downloads a table rather than a loading state plus a second
 * round trip. Interactive screens use `./browser.ts` through TanStack Query
 * instead.
 *
 * Both clients read the same bodies and raise the same `ApiError`, so a screen
 * can move between them without its error handling changing.
 */

/**
 * Performs an authenticated call to the API on behalf of the signed-in
 * admin. Throws `ApiError` — never returns a partial result.
 */
export async function serverFetch(
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  if (!path.startsWith(`/${ADMIN_PATH_PREFIX}`)) {
    throw new ApiError(0, {
      detail: `refusing to call a non-admin path from the console: ${path}`,
    });
  }

  const incoming = await headers();
  const auth = await accessTokenFor({ headers: incoming });

  if (auth.token === null) {
    if (auth.reason === "ip-blocked") {
      throw new ApiError(403, { status: 403, code: "ip_not_allowed" });
    }
    throw new ApiError(auth.reason === "unreachable" ? 503 : 401, {
      detail:
        auth.reason === "unreachable"
          ? "could not verify the caller's admin role"
          : "no cloudflare access session",
    });
  }

  // The same matrix the BFF proxy enforces, applied to server-rendered reads
  // too. A page whose group does not cover the endpoint it fetches is a bug
  // that should surface here rather than as a 403 from the API with no
  // indication of which of the two matrices disagreed.
  if (!canCallApi(auth.roles, path)) {
    throw new ApiError(403, { detail: `the caller's admin role does not permit ${path}` });
  }

  return rawFetch(`${gatewayBaseUrl()}${path}`, {
    ...options,
    timeoutMs: options.timeoutMs ?? serverEnv().TELEMED_API_TIMEOUT_MS,
    headers: {
      ...options.headers,
      ...accessHeaders(auth.token),
      // The admin's own address, resolved from the hop in front of us and
      // never copied from the caller's own header; see `clientAddress`.
      ...forwardingHeaders(incoming),
    },
  });
}

/** GET a resource. */
export async function getServer<T>(path: string, options?: RequestOptions): Promise<T> {
  return parseBody<T>(await serverFetch(path, options));
}

/** GET a page: `{items, page, pageSize, total}`. */
export async function listServer<T>(path: string, options?: RequestOptions): Promise<Paged<T>> {
  return getServer<Paged<T>>(path, options);
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
    return { ok: false, error: toApiError(cause) };
  }
}

/** List variant of `tryGetServer`. */
export async function tryListServer<T>(
  path: string,
  options?: RequestOptions,
): Promise<{ ok: true; page: Paged<T> } | { ok: false; error: ApiError }> {
  try {
    return { ok: true, page: await listServer<T>(path, options) };
  } catch (cause) {
    return { ok: false, error: toApiError(cause) };
  }
}
