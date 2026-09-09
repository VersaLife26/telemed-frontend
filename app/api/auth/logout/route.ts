import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/consumer/auth/cookies";

export async function POST() {
  await clearAuthCookies();
  return NextResponse.json({ data: { ok: true } });
}
