import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/consumer/api/client";
import { clearAuthCookies, getRefreshToken } from "@/lib/consumer/auth/cookies";

export async function POST() {
  const refresh = await getRefreshToken();
  if (refresh) {
    try {
      await apiFetch("/api/v1/auth/logout", {
        method: "POST",
        body: { refreshToken: refresh },
      });
    } catch {
      // Cookie clear is the session the browser cares about.
    }
  }
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
