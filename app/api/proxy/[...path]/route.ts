import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/consumer/env";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { gatewayUrl, isNullBodyStatus, shouldForwardBody } from "@/lib/consumer/proxy";

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  const incoming = new URL(req.url);
  const target = gatewayUrl(API_BASE_URL, path, incoming.search);

  const headers = new Headers();
  headers.set("Accept", "application/json");
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const token = await getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };
  if (shouldForwardBody(req.method)) {
    const isMultipart = (contentType || "").toLowerCase().includes("multipart/form-data");
    if (isMultipart && req.body) {
      // Stream multipart through. Buffering with arrayBuffer() can desync the
      // boundary in Content-Type from the bytes the gateway parses.
      init.body = req.body;
      Object.assign(init, { duplex: "half" });
    } else {
      init.body = await req.arrayBuffer();
    }
  }

  try {
    const upstream = await fetch(target, init);
    // Vault DELETE (and similar) returns 204 with an empty body. Building a
    // NextResponse with even an empty string body for a null-body status
    // throws in undici, which this catch turned into Cloudflare's 502 page.
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

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
