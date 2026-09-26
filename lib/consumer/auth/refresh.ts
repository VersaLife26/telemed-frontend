import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/consumer/env";
import { apiFetch } from "@/lib/consumer/api/client";
import { ApiError } from "@/lib/consumer/api/errors";
import type { AuthResponse } from "@/lib/consumer/api/types";

export function shouldAttemptRefresh(pathname: string, hasAccess: boolean, hasRefresh: boolean): boolean {
  if (hasAccess || !hasRefresh) return false;
  if (pathname === "/api/auth/refresh" || pathname.startsWith("/api/auth/refresh/")) return false;
  if (pathname === "/api/auth/logout" || pathname.startsWith("/api/auth/logout/")) return false;
  return true;
}

export function cookieHeaderWithAuth(existing: string, access: string, refresh: string): string {
  const kept = existing
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      const name = part.split("=", 1)[0];
      return name !== ACCESS_COOKIE && name !== REFRESH_COOKIE;
    });
  kept.push(`${ACCESS_COOKIE}=${access}`, `${REFRESH_COOKIE}=${refresh}`);
  return kept.join("; ");
}

/**
 * Refresh tokens rotate on every use, so the caller must persist the returned
 * refresh token before retrying anything: presenting the old one again more
 * than 30 seconds later revokes the whole session family.
 */
export async function fetchRefreshedTokens(refreshToken: string): Promise<
  { ok: true; tokens: AuthResponse } | { ok: false; invalidate: boolean }
> {
  try {
    const data = await apiFetch<AuthResponse>("/api/v1/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    });
    if (!data.accessToken || !data.refreshToken) {
      return { ok: false, invalidate: false };
    }
    return { ok: true, tokens: data };
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    return { ok: false, invalidate: status === 401 || status === 403 };
  }
}
