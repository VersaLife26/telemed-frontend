import { completePasswordReset, problem, toClientError } from "@/lib/consumer/auth/session";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; newPassword?: string };
    if (!body.token?.trim() || !body.newPassword) {
      return problem(400, "Reset token and new password are required");
    }
    return await completePasswordReset({
      token: body.token.trim(),
      newPassword: body.newPassword,
    });
  } catch (err) {
    return toClientError(err);
  }
}
