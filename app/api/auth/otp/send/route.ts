import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/consumer/api/client";
import { problem, toClientError } from "@/lib/consumer/auth/session";
import { sendOtpBody, sendOtpError } from "@/lib/consumer/features/otp";
import type { OtpSent } from "@/lib/consumer/api/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { phone?: string };
    const missing = sendOtpError(body.phone);
    if (missing) {
      return problem(400, missing);
    }
    const data = await apiFetch<OtpSent>("/api/v1/auth/otp/send", {
      method: "POST",
      body: sendOtpBody(body.phone!),
    });
    return NextResponse.json(data);
  } catch (err) {
    return toClientError(err);
  }
}
