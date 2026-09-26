import { completeGoogleLogin, problem, toClientError } from "@/lib/consumer/auth/session";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idToken?: string };
    if (!body.idToken?.trim()) {
      return problem(400, "Google sign-in did not return a token");
    }
    return await completeGoogleLogin(body.idToken.trim());
  } catch (err) {
    return toClientError(err);
  }
}
