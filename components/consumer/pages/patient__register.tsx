"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthDivider, GoogleButton } from "@/components/consumer/auth/GoogleButton";
import { AuthFooterLink, AuthHeading, AuthLayout } from "@/components/consumer/layout/AuthLayout";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";

function readError(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && "message" in json) {
    const message = (json as { message?: string }).message;
    if (message) return message;
  }
  return fallback;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"email" | "google" | null>(null);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("email");
    try {
      const res = await fetch("/api/auth/email/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error(readError(json, "Could not create account"));
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
        body: JSON.stringify({ id_token: idToken }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error(readError(json, "Google sign-in failed"));
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <AuthLayout blurb="VersaLife Telemedicine. Consult trusted doctors online — anytime, anywhere in Sri Lanka.">
      <div className="flex w-full flex-col gap-6">
        <AuthHeading
          title={
            <>
              <p>Create your</p>
              <p>account</p>
            </>
          }
          subtitle="Register with Google or an email and password."
        />
        <GoogleButton onCredential={onGoogle} disabled={busy} />
        <AuthDivider />
        <form onSubmit={onRegister} className="flex w-full flex-col gap-4">
          <Input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
          <Input
            type="email"
            autoComplete="email"
            required
            focused
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (8+ characters)"
          />
          {error ? <p className="text-body-sm text-danger">{error}</p> : null}
          <Button type="submit" fullWidth busy={loading === "email"} disabled={busy}>
            {loading === "email" ? "Creating…" : "Create account"}
          </Button>
        </form>
        <AuthFooterLink text="Already have an account?" linkText="Sign in" href="/login" />
      </div>
    </AuthLayout>
  );
}
