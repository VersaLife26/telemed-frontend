import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/consumer/api/client";
import { ApiError } from "@/lib/consumer/api/errors";
import { clearAuthCookies, getRefreshToken, setAuthCookies } from "@/lib/consumer/auth/cookies";
import { fetchRefreshedTokens } from "@/lib/consumer/auth/refresh";
import { SURFACE } from "@/lib/consumer/surface";
import type { AuthResponse } from "@/lib/consumer/api/types";

/** A BFF-originated error, shaped like the API's own problem responses so the browser reads one format. */
export function problem(status: number, detail: string, code?: string) {
  return NextResponse.json(
    { status, title: detail, detail, ...(code ? { code } : {}) },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

export function gatewayUnreachable() {
  return problem(502, "Could not reach the TeleMed API. Check NEXT_PUBLIC_API_BASE_URL.", "gateway_unreachable");
}

export function toClientError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(err.body, {
      status: err.status,
      headers: { "Content-Type": "application/problem+json" },
    });
  }
  return gatewayUnreachable();
}

export async function completePasswordLogin(body: unknown) {
  const data = await apiFetch<AuthResponse>("/api/v1/auth/login/email", {
    method: "POST",
    body,
  });
  return finishAuth(data, requiredRole());
}

export async function completeEmailRegister(body: unknown) {
  const data = await apiFetch<AuthResponse>("/api/v1/auth/register/email", {
    method: "POST",
    body,
  });
  return finishAuth(data);
}

export async function completeGoogleLogin(idToken: string) {
  try {
    const data = await apiFetch<AuthResponse>("/api/v1/auth/google", {
      method: "POST",
      body: { idToken },
    });
    return finishAuth(data, requiredRole());
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw new ApiError(404, { status: 404, detail: "Google sign-in is not available right now." });
    }
    throw err;
  }
}

/**
 * The role a session must hold on this surface, or undefined where any role is
 * acceptable.
 *
 * The doctor app must refuse a patient token even though the API issued it
 * honestly: both surfaces authenticate against the same user store, so the
 * token is valid, and only this check keeps a patient out of the doctor
 * console.
 */
export function requiredRole(): string | undefined {
  return SURFACE === "doctor" ? "doctor" : undefined;
}

export async function finishAuth(data: AuthResponse, requireRole?: string) {
  if (!data.accessToken || !data.refreshToken) {
    return problem(502, "Login response missing tokens");
  }
  if (requireRole && data.user?.role && data.user.role !== requireRole) {
    return problem(
      403,
      requireRole === "doctor"
        ? "This account is not a doctor account. Sign in on the patient app, or ask support to grant doctor access."
        : "This account cannot use this app.",
    );
  }
  await setAuthCookies(data.accessToken, data.refreshToken);
  return NextResponse.json({ ok: true, user: data.user ?? null });
}

export async function completeRefresh() {
  const refresh = await getRefreshToken();
  if (!refresh) {
    return problem(401, "Not signed in");
  }
  const result = await fetchRefreshedTokens(refresh);
  if (!result.ok) {
    if (result.invalidate) await clearAuthCookies();
    return problem(401, "Session expired. Sign in again.");
  }
  return finishAuth(result.tokens, requiredRole());
}

/** Rotate the access cookie when it is missing and a refresh cookie is still live. */
export async function refreshAuthCookies(): Promise<string | undefined> {
  const refresh = await getRefreshToken();
  if (!refresh) return undefined;
  const result = await fetchRefreshedTokens(refresh);
  if (!result.ok) {
    if (result.invalidate) await clearAuthCookies();
    return undefined;
  }
  await setAuthCookies(result.tokens.accessToken, result.tokens.refreshToken);
  return result.tokens.accessToken;
}
