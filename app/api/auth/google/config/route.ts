import { NextResponse } from "next/server";
import { GOOGLE_CLIENT_ID } from "@/lib/consumer/env";

export async function GET() {
  const clientId = GOOGLE_CLIENT_ID;
  return NextResponse.json({
    data: {
      enabled: clientId.length > 0,
      client_id: clientId || null,
    },
  });
}
