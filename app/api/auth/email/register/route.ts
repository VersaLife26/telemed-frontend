import { apiFetch } from "@/lib/consumer/api/client";
import {
  completeEmailRegister,
  finishAuth,
  toClientError,
  type AuthTokens,
} from "@/lib/consumer/auth/session";
import type { TelemedUser } from "@/lib/consumer/api/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
      date_of_birth?: string;
      sex?: string;
      allergies?: string;
    };
    if (!body.email?.trim() || !body.password) {
      return Response.json({ message: "Email and password are required" }, { status: 400 });
    }
    const dob = body.date_of_birth?.trim();
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return Response.json({ message: "Date of birth must be YYYY-MM-DD." }, { status: 400 });
    }

    const payload = {
      email: body.email.trim(),
      password: body.password,
      name: body.name?.trim() || undefined,
    };

    const sex = ["female", "male", "other"].includes(body.sex || "") ? body.sex : "";
    const allergies = body.allergies?.trim().slice(0, 1000) || "";

    if (!dob && !sex && !allergies) {
      return await completeEmailRegister(payload);
    }

    const tokens = await apiFetch<AuthTokens>("/api/v1/auth/register/email", {
      method: "POST",
      body: payload,
    });
    const user = tokens.user;
    if (tokens.access_token && user) {
      await apiFetch<TelemedUser>("/api/v1/users/me", {
        method: "PUT",
        token: tokens.access_token,
        body: {
          name: user.name || body.name?.trim() || "Patient",
          phone: user.phone || "",
          address: user.address || "",
          date_of_birth: dob || user.date_of_birth || "",
          sex,
          allergies,
          language: user.language || "en",
          version: user.version ?? 0,
        },
      }).catch(() => undefined);
    }
    return finishAuth(tokens);
  } catch (err) {
    return toClientError(err);
  }
}
