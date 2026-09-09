import { NextResponse } from "next/server";

import { accessTokenFor, forwardingHeaders, gatewayBaseUrl, ipAllowlistRejects } from "@/lib/admin/api/gateway";
import { adminUpstreamPath, safeContentType, sameOriginRequest } from "@/lib/admin/api/upstream";
import { serverEnv } from "@/lib/admin/env";
import { canCallApi } from "@/lib/admin/rbac";

/**
 * Backend-for-frontend proxy.
 *
 * Every call the browser makes to the platform goes through here. The reason
 * is one line long: the Keycloak access token never enters the browser. It
 * stays in the encrypted Auth.js cookie, is read server-side, and is attached
 * to the upstream request here. An XSS on the admin console therefore cannot
 * exfiltrate a token that can be replayed against the API gateway from
 * anywhere else — and with `connect-src 'self'` in the CSP, injected script
 * cannot reach the gateway directly either.
 *
 * Because this handler holds a `super_admin` bearer token, every check it makes
 * has to hold *here*, in the handler. `proxy.ts` runs first and is useful, but
 * it is a matcher away from not running, and a route handler that relies on
 * middleware is a route handler with no access control. So the order below is
 * the whole control, top to bottom:
 *
 *   1. method allowlist;
 *   2. path validation, segment by segment, against `/api/v1/admin/*`;
 *   3. same-origin check on anything that changes state;
 *   4. session — the token and the roles it carries;
 *   5. **role check against the same RBAC matrix admin-service enforces**,
 *      failing closed on any path the matrix does not name.
 *
 * Step 5 did not exist. `proxy.ts` calls `canVisit`, which maps a *page* path
 * to a group and returns `true` for anything unmapped — and no `/api/gateway/*`
 * path is a page path. The proxy was therefore an unrestricted pass-through:
 * a `support` account could `PUT /api/v1/admin/finance/commission-rules`
 * through it, and the only thing that stopped them was admin-service saying no.
 * That is one layer where the console's own documentation claims two.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/** Response headers worth passing back to the browser. */
const PASSTHROUGH_HEADERS = ["content-disposition", "x-request-id", "retry-after"];

async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!ALLOWED_METHODS.has(request.method)) {
    return errorResponse(405, "BAD_REQUEST", `method ${request.method} is not proxied`);
  }

  const { path } = await context.params;

  // The console must not become an open proxy to the whole platform. Only the
  // admin surface is reachable, and no segment may be anything but a plain
  // path element.
  const upstreamPath = adminUpstreamPath(path);
  if (upstreamPath === null) {
    return errorResponse(403, "FORBIDDEN", "only the admin API surface is proxied");
  }

  const incoming = new URL(request.url);

  if (!sameOriginRequest(request.method, request.headers, incoming.origin)) {
    return errorResponse(403, "FORBIDDEN", "cross-origin requests are not proxied");
  }

  const auth = await accessTokenFor(request);
  if (auth.token === null) {
    return errorResponse(
      401,
      "UNAUTHORIZED",
      auth.reason === "refresh-failed"
        ? "session could not be refreshed"
        : "authentication required",
    );
  }

  if (!canCallApi(auth.roles, `/${upstreamPath}`)) {
    return errorResponse(
      403,
      "FORBIDDEN",
      "your admin role does not permit this call",
    );
  }

  const target = new URL(`${gatewayBaseUrl()}/${upstreamPath}`);
  target.search = incoming.search;

  const headers = new Headers({
    Accept: request.headers.get("accept") ?? "application/json",
    Authorization: `Bearer ${auth.token}`,
    // Naming the origin lets the gateway's admin-origin check pass on the
    // console and still refuse the patient and doctor frontends.
    Origin: incoming.origin,
    ...forwardingHeaders(request.headers),
  });

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const hasBody = request.method !== "GET" && request.method !== "DELETE";

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(serverEnv().TELEMED_API_TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    return errorResponse(
      timedOut ? 504 : 502,
      timedOut ? "TIMEOUT" : "SERVICE_UNAVAILABLE",
      timedOut ? "the gateway did not respond in time" : "could not reach the API gateway",
    );
  }

  // A 403 is ambiguous at the gateway: `IPAllowlist` and `RequireRole` both
  // answer with httpx.ErrForbidden. Resolve it once, here, so no screen has to.
  if (upstream.status === 403 && (await ipAllowlistRejects(request))) {
    return errorResponse(
      403,
      "IP_NOT_ALLOWLISTED",
      "the API gateway refused this network address",
      upstream.headers.get("x-request-id"),
    );
  }

  const responseHeaders = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  // The upstream's content type is honoured only if it is one this origin can
  // safely hand to a browser; see `safeContentType`.
  const { contentType: outboundType, attachment } = safeContentType(
    upstream.headers.get("content-type"),
  );
  responseHeaders.set("Content-Type", outboundType);
  if (attachment && !responseHeaders.has("content-disposition")) {
    responseHeaders.set("Content-Disposition", "attachment");
  }
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId?: string | null,
): NextResponse {
  return NextResponse.json(
    { code, message, ...(requestId ? { request_id: requestId } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
