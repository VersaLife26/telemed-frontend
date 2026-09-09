import { SURFACE } from "@/lib/consumer/surface";
import { completeGoogleLogin, toClientError } from "@/lib/consumer/auth/session";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id_token?: string };
    if (!body.id_token?.trim()) {
      return Response.json({ message: "Google sign-in did not return a token" }, { status: 400 });
    }
    // Patients self-register through Google; doctors never do. A doctor is
    // onboarded through the application and OTP flow, and creating one here
    // would put an unverified clinician on the platform.
    return await completeGoogleLogin({
      id_token: body.id_token.trim(),
      create_account: SURFACE === "patient",
    });
  } catch (err) {
    return toClientError(err);
  }
}
