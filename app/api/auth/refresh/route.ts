import { completeRefresh } from "@/lib/consumer/auth/session";

export async function POST() {
  return completeRefresh();
}
