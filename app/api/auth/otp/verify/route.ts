import { apiFetch } from "@/lib/consumer/api/client";
import { finishAuth, problem, requiredRole, toClientError } from "@/lib/consumer/auth/session";
import { missingTokensMessage, verifyOtpBody, verifyOtpError } from "@/lib/consumer/features/otp";
import type { AuthResponse } from "@/lib/consumer/api/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { phone?: string; code?: string };
    const missing = verifyOtpError(body.phone, body.code);
    if (missing) {
      return problem(400, missing);
    }
    const data = await apiFetch<AuthResponse>("/api/v1/auth/otp/verify", {
      method: "POST",
      body: verifyOtpBody(body.phone!, body.code!),
    });
    if (!data.accessToken || !data.refreshToken) {
      return problem(502, missingTokensMessage());
    }
    return await finishAuth(data, requiredRole());
  } catch (err) {
    return toClientError(err);
  }
}
