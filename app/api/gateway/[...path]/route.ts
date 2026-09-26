import { NextResponse } from "next/server";

import { accessTokenFor, forwardingHeaders, gatewayBaseUrl } from "@/lib/admin/api/gateway";
import { accessHeaders } from "@/lib/admin/auth/access";
import {
  adminUpstreamPath,
  fileUpstreamPath,
  safeContentType,
  sameOriginRequest,
} from "@/lib/admin/api/upstream";
import { serverEnv } from "@/lib/admin/env";
import { canCallApi } from "@/lib/admin/rbac";

/**
 * Backend-for-frontend proxy.
 *
 * Every call the browser makes to the platform goes through here. The
 * Cloudflare Access JWT arrives on the request, is read server-side here, and
 * is attached to the upstream call in `Cf-Access-Jwt-Assertion`. With
 * `connect-src 'self'` in the CSP, injected script cannot reach the API
 * directly either.
 *
 * (The Access cookie is necessarily present in the browser, since Access set
 * it — but it is scoped to this hostname and is the credential Access itself
 * checks at the edge, not a bearer for the API.)
 *
 * Because this handler holds a `superAdmin` Access token, every check it makes
 * has to hold *here*, in the handler. `proxy.ts` runs first and is useful, but
 * it is a matcher away from not running, and a route handler that relies on
 * middleware is a route handler with no access control. So the order below is
 * the whole control, top to bottom:
 *
 *   1. method allowlist;
 *   2. path validation, segment by segment, against `/api/v1/admin/*` (or a
 *      GET of a signed `/api/v1/files/{token}` link);
 *   3. same-origin check on anything that changes state;
 *   4. session — the token and the roles it carries;
 *   5. **role check against the same permission matrix the API enforces**,
 *      failing closed on any path the matrix does not name. Signed file links
 *      skip it: the token was minted for a caller who passed it already.
 *
 * Errors originated here are ProblemDetails-shaped, like the API's own, so
 * the browser client reads both the same way.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/** Response headers worth passing back to the browser. */
const PASSTHROUGH_HEADERS = ["content-disposition", "retry-after"];

async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!ALLOWED_METHODS.has(request.method)) {
    return problem(405, `method ${request.method} is not proxied`);
  }

  const { path } = await context.params;

  // The console must not become an open proxy to the whole platform. Only the
  // admin surface and signed file links are reachable, and no segment may be
  // anything but a plain path element.
  const filePath = request.method === "GET" ? fileUpstreamPath(path) : null;
  const upstreamPath = filePath ?? adminUpstreamPath(path);
  if (upstreamPath === null) {
    return problem(403, "only the admin API surface is proxied");
  }

  const incoming = new URL(request.url);

  if (!sameOriginRequest(request.method, request.headers, incoming.origin)) {
    return problem(403, "cross-origin requests are not proxied", "origin_not_allowed");
  }

  const auth = await accessTokenFor(request);
  if (auth.token === null) {
    // 503, not 401, when the backend could not be asked who this is: the
    // caller's Access session is fine and telling them to authenticate again
    // would send them round a loop that cannot fix anything.
    if (auth.reason === "unreachable") {
      return problem(503, "could not verify your admin role; try again shortly");
    }
    if (auth.reason === "ip-blocked") {
      return problem(403, "your network is not allowed to reach the admin API", "ip_not_allowed");
    }
    return problem(401, "authentication required");
  }

  if (filePath === null && !canCallApi(auth.roles, `/${upstreamPath}`)) {
    return problem(403, "your admin role does not permit this call");
  }

  const target = new URL(`${gatewayBaseUrl()}/${upstreamPath}`);
  target.search = incoming.search;

  const headers = new Headers({
    Accept: request.headers.get("accept") ?? "application/json",
    // A signed file link carries its own credential; the Access identity is
    // not sent where it is not needed.
    ...(filePath === null
      ? {
          ...accessHeaders(auth.token),
          // Naming the origin lets the API's admin-origin check pass on the
          // console and still refuse the patient and doctor frontends.
          Origin: incoming.origin,
        }
      : {}),
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
    return problem(
      timedOut ? 504 : 502,
      timedOut ? "the API did not respond in time" : "could not reach the API",
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

function problem(status: number, detail: string, code?: string): NextResponse {
  return NextResponse.json(
    { status, detail, ...(code ? { code } : {}) },
    {
      status,
      headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store" },
    },
  );
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
