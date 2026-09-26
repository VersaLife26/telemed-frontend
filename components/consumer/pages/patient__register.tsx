"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthDivider, GoogleButton } from "@/components/consumer/auth/GoogleButton";
import { AuthFooterLink, AuthHeading, AuthLayout } from "@/components/consumer/layout/AuthLayout";
import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Reveal } from "@/components/consumer/ui/Reveal";
import { Input } from "@/components/consumer/ui/Input";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { SexField } from "@/components/consumer/sex-field";
import type { Sex } from "@/lib/consumer/api/types";
import { problemMessage } from "@/lib/consumer/api/errors";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<Sex | "">("");
  const [allergies, setAllergies] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"email" | "google" | null>(null);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      setError("Enter your date of birth.");
      return;
    }
    if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
      setError("Date of birth cannot be in the future.");
      return;
    }
    setLoading("email");
    try {
      const res = await fetch("/api/auth/email/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName: name, dateOfBirth, sex, allergies }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error(problemMessage(json, "Could not create account"));
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setLoading(null);
    }
  }

  async function onGoogle(idToken: string) {
    setError(null);
    setLoading("google");
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error(problemMessage(json, "Google sign-in failed"));
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <AuthLayout>
      <div className="flex w-full flex-col gap-7">
        <AuthHeading
          title="Create your account"
          subtitle="Register with Google or an email and password."
        />

        <Reveal delay={1} className="flex flex-col gap-7">
          <GoogleButton onCredential={onGoogle} disabled={busy} />
          <AuthDivider />

          <form onSubmit={onRegister} className="flex w-full flex-col gap-4">
            <Input
              id="register-name"
              label="Full name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            <Input
              id="register-dob"
              label="Date of birth"
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="tabular-time"
            />
            <SexField id="register-sex" value={sex} onChange={setSex} />
            <Textarea
              id="register-allergies"
              label="Known allergies"
              hint="Optional. Medicines, foods or anything else your doctor should know."
              rows={2}
              className="min-h-16"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="e.g. Penicillin"
            />
            <Input
              id="register-email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Input
              id="register-password"
              label="Password"
              hint="At least 8 characters."
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Button type="submit" size="lg" fullWidth busy={loading === "email"} disabled={busy}>
              {loading === "email" ? "Creating…" : "Create account"}
            </Button>
          </form>

          <AuthFooterLink text="Already have an account?" linkText="Sign in" href="/login" />
        </Reveal>
      </div>
    </AuthLayout>
  );
}
