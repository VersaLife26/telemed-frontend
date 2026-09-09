import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/consumer/auth/cookies";

export default async function RootPage(): Promise<never> {
  const token = await getAccessToken();
  return redirect(token ? "/home" : "/login");
}
