import { countryHeaders } from "@/lib/consumer/auth/country";
import { completeGoogleLogin, problem, toClientError } from "@/lib/consumer/auth/session";
import { residencyFields } from "@/lib/consumer/features/residency";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      idToken?: string;
      isSriLankanCitizen?: boolean;
      nationalId?: string;
    };
    if (!body.idToken?.trim()) {
      return problem(400, "Google sign-in did not return a token");
    }
    return await completeGoogleLogin(body.idToken.trim(), {
      headers: countryHeaders(req),
      residency: residencyFields(
        typeof body.isSriLankanCitizen === "boolean" ? body.isSriLankanCitizen : null,
        body.nationalId ?? "",
      ),
    });
  } catch (err) {
    return toClientError(err);
  }
}
