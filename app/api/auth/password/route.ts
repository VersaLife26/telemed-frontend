import { apiFetch } from "@/lib/consumer/api/client";
import type { AuthResponse } from "@/lib/consumer/api/types";
import { getAccessToken } from "@/lib/consumer/auth/cookies";
import { finishAuth, problem, refreshAuthCookies, requiredRole, toClientError } from "@/lib/consumer/auth/session";

/**
 * PUT /me/password revokes every other session and answers with a fresh token
 * pair, so the change goes through here to swap the auth cookies; through the
 * generic proxy the browser would keep a refresh token that no longer works.
 */
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { currentPassword?: string | null; newPassword?: string };
    if (!body.newPassword) {
      return problem(400, "Enter a new password");
    }
    const token = (await getAccessToken()) || (await refreshAuthCookies());
    if (!token) {
      return problem(401, "Not signed in");
    }
    const data = await apiFetch<AuthResponse>("/api/v1/me/password", {
      method: "PUT",
      token,
      body: { currentPassword: body.currentPassword || null, newPassword: body.newPassword },
    });
    return await finishAuth(data, requiredRole());
  } catch (err) {
    return toClientError(err);
  }
}
