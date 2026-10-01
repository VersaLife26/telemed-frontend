import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/consumer/api/client";
import { problem, toClientError } from "@/lib/consumer/auth/session";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    if (!body.email?.trim()) {
      return problem(400, "Email is required");
    }
    await apiFetch("/api/v1/auth/password/forgot", {
      method: "POST",
      body: { email: body.email.trim() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toClientError(err);
  }
}
