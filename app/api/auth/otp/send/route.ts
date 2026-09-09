import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/consumer/api/client";
import { ApiError } from "@/lib/consumer/api/envelope";
import { sendOtpBody, sendOtpError } from "@/lib/consumer/features/otp";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { phone?: string; purpose?: string };
    const missing = sendOtpError(body.phone);
    if (missing) {
      return NextResponse.json({ message: missing }, { status: 400 });
    }

    const data = await apiFetch<{
      request_id: string;
      expires_in: number;
      attempts_remaining: number;
    }>("/api/v1/auth/otp/send", {
      method: "POST",
      body: sendOtpBody(body.phone!, body.purpose),
    });

    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body, { status: err.status });
    }
    return NextResponse.json(
      {
        message:
          "Could not reach API gateway. Start telemed-api-gateway or check NEXT_PUBLIC_API_BASE_URL.",
      },
      { status: 502 },
    );
  }
}
