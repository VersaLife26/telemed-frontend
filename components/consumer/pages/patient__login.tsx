"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthDivider, GoogleButton } from "@/components/consumer/auth/GoogleButton";
import { AuthFooterLink, AuthHeading, AuthLayout } from "@/components/consumer/layout/AuthLayout";
import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { Reveal } from "@/components/consumer/ui/Reveal";
import { assets } from "@/lib/consumer/assets";
import { problemMessage } from "@/lib/consumer/api/errors";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"email" | "otp" | "google" | null>(null);

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("email");
    try {
      const res = await fetch("/api/auth/email/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error(problemMessage(json, "Could not sign in"));
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setLoading(null);
    }
  }

  async function onOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("otp");
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error(problemMessage(json, "Failed to send OTP"));
      router.push(`/login/otp?phone=${encodeURIComponent(phone)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
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
        <AuthHeading title="Sign in" subtitle="Use Google, email, or your mobile number." />

        <Reveal delay={1} className="flex flex-col gap-7">
          <GoogleButton onCredential={onGoogle} disabled={busy} />

          <form onSubmit={onEmail} className="flex w-full flex-col gap-4">
            <Input
              id="login-email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Input
              id="login-password"
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Button type="submit" size="lg" fullWidth busy={loading === "email"} disabled={busy}>
              {loading === "email" ? "Signing in…" : "Sign in with email"}
            </Button>
          </form>

          <AuthDivider label="or use mobile" />

          <form onSubmit={onOtp} className="flex w-full flex-col gap-4">
            <Input
              id="login-phone"
              label="Mobile number"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+9477XXXXXXX"
            />
            <Button
              type="submit"
              variant="outline"
              size="lg"
              fullWidth
              busy={loading === "otp"}
              disabled={busy}
              icon={assets.phoneIcon}
            >
              {loading === "otp" ? "Sending…" : "Send OTP"}
            </Button>
          </form>

          <AuthFooterLink text="New here?" linkText="Create an account" href="/register" />
        </Reveal>
      </div>
    </AuthLayout>
  );
}
