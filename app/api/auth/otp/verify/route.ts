import { apiFetch } from "@/lib/consumer/api/client";
import { toClientError, finishAuth, requiredRole } from "@/lib/consumer/auth/session";
import { missingTokensMessage, verifyOtpBody, verifyOtpError } from "@/lib/consumer/features/otp";
import type { AuthTokens } from "@/lib/consumer/auth/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      phone?: string;
      code?: string;
      otp?: string;
      purpose?: string;
    };
    const missing = verifyOtpError(body.phone, body.otp, body.code);
    if (missing) {
      return NextResponse.json({ message: missing }, { status: 400 });
    }

    const data = await apiFetch<AuthTokens>("/api/v1/auth/otp/verify", {
      method: "POST",
      body: verifyOtpBody(body.phone!, (body.otp || body.code || ""), body.purpose),
    });
    if (!data.access_token || !data.refresh_token) {
      return NextResponse.json({ message: missingTokensMessage() }, { status: 502 });
    }
    return await finishAuth(data, requiredRole());
  } catch (err) {
    return toClientError(err);
  }
}
