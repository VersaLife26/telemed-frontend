import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/consumer/env";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { refreshAuthCookies } from "@/lib/consumer/auth/session";
import { gatewayUrl, isNullBodyStatus, shouldForwardBody } from "@/lib/consumer/proxy";

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  const incoming = new URL(req.url);
  const target = gatewayUrl(API_BASE_URL, path, incoming.search);

  const contentType = req.headers.get("content-type");
  const streamMultipart =
    Boolean(contentType?.toLowerCase().includes("multipart/form-data")) && Boolean(req.body);
  let body: BodyInit | undefined;
  if (shouldForwardBody(req.method)) {
    if (streamMultipart && req.body) {
      body = req.body;
    } else {
      body = await req.arrayBuffer();
    }
  }

  let token = await getAccessToken();
  let refreshed = false;
  if (!token) {
    token = await refreshAuthCookies();
    refreshed = Boolean(token);
  }

  const run = (bearer?: string) => fetchUpstream(target, req.method, contentType, bearer, body, streamMultipart);

  try {
    let upstream = await run(token);
    if (upstream.status === 401 && !refreshed && !streamMultipart) {
      const next = await refreshAuthCookies();
      if (next) upstream = await run(next);
    }
    if (isNullBodyStatus(upstream.status)) {
      return new NextResponse(null, { status: upstream.status });
    }
    const upstreamType = upstream.headers.get("Content-Type") || "application/json";
    const isBinary =
      upstreamType.startsWith("image/") ||
      upstreamType.startsWith("application/pdf") ||
      upstreamType.startsWith("application/octet-stream");
    if (isBinary) {
      const bytes = await upstream.arrayBuffer();
      return new NextResponse(bytes, {
        status: upstream.status,
        headers: {
          "Content-Type": upstreamType,
          "Cache-Control": upstream.headers.get("Cache-Control") || "private, no-store",
        },
      });
    }
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstreamType,
      },
    });
  } catch {
    return NextResponse.json(
      {
        code: "GATEWAY_UNREACHABLE",
        message:
          "Cannot reach telemed-api-gateway. Start infra (`cd telemed-infra && make bootstrap`) and set NEXT_PUBLIC_API_BASE_URL.",
      },
      { status: 502 },
    );
  }
}

async function fetchUpstream(
  target: string,
  method: string,
  contentType: string | null,
  token: string | undefined,
  body: BodyInit | undefined,
  streamMultipart: boolean,
) {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (contentType) headers.set("Content-Type", contentType);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };
  if (body !== undefined) {
    init.body = body;
    if (streamMultipart) Object.assign(init, { duplex: "half" });
  }
  return fetch(target, init);
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
