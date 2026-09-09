import { completeEmailRegister, toClientError } from "@/lib/consumer/auth/session";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string; name?: string };
    if (!body.email?.trim() || !body.password) {
      return Response.json({ message: "Email and password are required" }, { status: 400 });
    }
    return await completeEmailRegister({
      email: body.email.trim(),
      password: body.password,
      name: body.name?.trim() || undefined,
    });
  } catch (err) {
    return toClientError(err);
  }
}
