import { apiFetch } from "@/lib/consumer/api/client";
import { countryHeaders } from "@/lib/consumer/auth/country";
import { finishAuth, problem, requiredRole, toClientError } from "@/lib/consumer/auth/session";
import { missingTokensMessage, verifyOtpBody, verifyOtpError } from "@/lib/consumer/features/otp";
import { residencyFields } from "@/lib/consumer/features/residency";
import type { AuthResponse } from "@/lib/consumer/api/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      phone?: string;
      code?: string;
      isSriLankanCitizen?: boolean;
      nationalId?: string;
    };
    const missing = verifyOtpError(body.phone, body.code);
    if (missing) {
      return problem(400, missing);
    }
    const data = await apiFetch<AuthResponse>("/api/v1/auth/otp/verify", {
      method: "POST",
      headers: countryHeaders(req),
      body: verifyOtpBody(
        body.phone!,
        body.code!,
        residencyFields(
          typeof body.isSriLankanCitizen === "boolean" ? body.isSriLankanCitizen : null,
          body.nationalId ?? "",
        ),
      ),
    });
    if (!data.accessToken || !data.refreshToken) {
      return problem(502, missingTokensMessage());
    }
    return await finishAuth(data, requiredRole());
  } catch (err) {
    return toClientError(err);
  }
}
