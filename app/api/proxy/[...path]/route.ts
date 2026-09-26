import { NextResponse } from "next/server";
import { API_BASE_URL, TEST_SECRET } from "@/lib/consumer/env";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { gatewayUnreachable, refreshAuthCookies } from "@/lib/consumer/auth/session";
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

  const uploadToken = req.headers.get("x-upload-token");
  const testSecret = path[0] === "test" ? TEST_SECRET : "";
  const run = (bearer?: string) =>
    fetchUpstream(target, req.method, contentType, bearer, body, streamMultipart, uploadToken, testSecret);

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
      const headers: Record<string, string> = {
        "Content-Type": upstreamType,
        "Cache-Control": upstream.headers.get("Cache-Control") || "private, no-store",
      };
      const disposition = upstream.headers.get("Content-Disposition");
      if (disposition) headers["Content-Disposition"] = disposition;
      return new NextResponse(bytes, { status: upstream.status, headers });
    }
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstreamType,
      },
    });
  } catch {
    return gatewayUnreachable();
  }
}

async function fetchUpstream(
  target: string,
  method: string,
  contentType: string | null,
  token: string | undefined,
  body: BodyInit | undefined,
  streamMultipart: boolean,
  uploadToken: string | null,
  testSecret: string,
) {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (contentType) headers.set("Content-Type", contentType);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (uploadToken) headers.set("X-Upload-Token", uploadToken);
  if (testSecret) headers.set("X-Test-Secret", testSecret);

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
