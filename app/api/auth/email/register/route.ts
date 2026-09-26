import { apiFetch } from "@/lib/consumer/api/client";
import {
  completeEmailRegister,
  finishAuth,
  problem,
  toClientError,
} from "@/lib/consumer/auth/session";
import type { AuthResponse, Sex, TelemedUser } from "@/lib/consumer/api/types";

const SEXES: Sex[] = ["female", "male", "other"];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      fullName?: string;
      dateOfBirth?: string;
      sex?: string;
      allergies?: string;
    };
    if (!body.email?.trim() || !body.password) {
      return problem(400, "Email and password are required");
    }
    const fullName = body.fullName?.trim();
    if (!fullName) {
      return problem(400, "Enter your name.");
    }
    const dob = body.dateOfBirth?.trim();
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return problem(400, "Date of birth must be YYYY-MM-DD.");
    }

    const payload = {
      email: body.email.trim(),
      password: body.password,
      fullName,
      language: "en",
    };

    const sex = SEXES.find((s) => s === body.sex) ?? null;
    const allergies = body.allergies?.trim().slice(0, 1000) || null;

    if (!dob && !sex && !allergies) {
      return await completeEmailRegister(payload);
    }

    // Register takes identity only; the clinical profile is a follow-up PUT /me.
    const tokens = await apiFetch<AuthResponse>("/api/v1/auth/register/email", {
      method: "POST",
      body: payload,
    });
    const user = tokens.user;
    if (tokens.accessToken && user) {
      const updated = await apiFetch<TelemedUser>("/api/v1/me", {
        method: "PUT",
        token: tokens.accessToken,
        body: {
          fullName: user.fullName || fullName,
          address: user.address ?? null,
          dateOfBirth: dob || user.dateOfBirth || null,
          sex,
          allergies,
          language: user.language || "en",
          version: user.version,
        },
      }).catch(() => undefined);
      if (updated) tokens.user = updated;
    }
    return finishAuth(tokens);
  } catch (err) {
    return toClientError(err);
  }
}
