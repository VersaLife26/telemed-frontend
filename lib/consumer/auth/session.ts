import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/consumer/api/client";
import { ApiError } from "@/lib/consumer/api/envelope";
import { clearAuthCookies, getRefreshToken, setAuthCookies } from "@/lib/consumer/auth/cookies";
import { fetchRefreshedTokens } from "@/lib/consumer/auth/refresh";
import { SURFACE } from "@/lib/consumer/surface";
import type { TelemedUser } from "@/lib/consumer/api/types";

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: TelemedUser;
};

export function gatewayUnreachable() {
  return NextResponse.json(
    {
      message:
        "Could not reach API gateway. Start telemed-api-gateway or check NEXT_PUBLIC_API_BASE_URL.",
    },
    { status: 502 },
  );
}

export function toClientError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(err.body, { status: err.status });
  }
  return gatewayUnreachable();
}

export async function completePasswordLogin(body: unknown) {
  const data = await apiFetch<AuthTokens>("/api/v1/auth/login/email", {
    method: "POST",
    body,
  });
  return finishAuth(data, requiredRole());
}

export async function completeEmailRegister(body: unknown) {
  const data = await apiFetch<AuthTokens>("/api/v1/auth/register/email", {
    method: "POST",
    body,
  });
  return finishAuth(data);
}

export async function completeGoogleLogin(body: unknown) {
  try {
    const data = await apiFetch<AuthTokens>("/api/v1/auth/oauth/google", {
      method: "POST",
      body,
    });
    return finishAuth(data, requiredRole());
  } catch (err) {
    // A doctor account is never created from a Google sign-in -- doctors are
    // onboarded through the application and OTP flow, and silently minting one
    // here would put an unverified clinician on the platform. The gateway
    // answers 404 for an unknown email; the patient surface never sees it
    // because it asks for the account to be created.
    if (SURFACE === "doctor" && err instanceof ApiError && err.status === 404) {
      throw new ApiError(404, {
        message:
          "No doctor account for this Google email. Sign in with your mobile number first, then save this email on your profile.",
      });
    }
    throw err;
  }
}

/**
 * The role a session must hold on this surface, or undefined where any role is
 * acceptable.
 *
 * The doctor app must refuse a patient token even though the gateway issued it
 * honestly: both surfaces authenticate against the same user-service, so the
 * token is valid, and only this check keeps a patient out of the doctor
 * console.
 */
export function requiredRole(): string | undefined {
  return SURFACE === "doctor" ? "doctor" : undefined;
}

export async function finishAuth(data: AuthTokens, requireRole?: string) {
  if (!data.access_token || !data.refresh_token) {
    return NextResponse.json({ message: "Login response missing tokens" }, { status: 502 });
  }
  if (requireRole && data.user?.role && data.user.role !== requireRole) {
    return NextResponse.json(
      {
        message:
          requireRole === "doctor"
            ? "This account is not a doctor account. Sign in on the patient app, or ask support to grant doctor access."
            : "This account cannot use this app.",
      },
      { status: 403 },
    );
  }
  await setAuthCookies(data.access_token, data.refresh_token);
  return NextResponse.json({ data: { ok: true, user: data.user ?? null } });
}

export async function completeRefresh() {
  const refresh = await getRefreshToken();
  if (!refresh) {
    return NextResponse.json({ message: "Not signed in" }, { status: 401 });
  }
  const result = await fetchRefreshedTokens(refresh);
  if (!result.ok) {
    if (result.invalidate) await clearAuthCookies();
    return NextResponse.json({ message: "Session expired. Sign in again." }, { status: 401 });
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
  await setAuthCookies(result.tokens.access_token, result.tokens.refresh_token);
  return result.tokens.access_token;
}
