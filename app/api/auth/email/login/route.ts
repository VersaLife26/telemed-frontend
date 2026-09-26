import { completePasswordLogin, problem, toClientError } from "@/lib/consumer/auth/session";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    if (!body.email?.trim() || !body.password) {
      return problem(400, "Email and password are required");
    }
    return await completePasswordLogin({
      email: body.email.trim(),
      password: body.password,
    });
  } catch (err) {
    return toClientError(err);
  }
}
