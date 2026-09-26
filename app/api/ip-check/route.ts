import { NextResponse } from "next/server";

import { ipAllowlistRejects } from "@/lib/admin/api/gateway";

/**
 * Answers "is this network on the admin IP allowlist?".
 *
 * Reachable without a session on purpose: an admin whose office VPN dropped
 * needs to be told *that*, and they cannot sign in to find out. The /ip-blocked
 * page polls this so the admin sees the page turn green the moment the VPN
 * reconnects, rather than reloading and guessing.
 *
 * It leaks nothing an unauthenticated caller could not already learn by
 * calling the API themselves and reading the problem code.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const blocked = await ipAllowlistRejects(request);
  return NextResponse.json(
    { allowed: !blocked },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
