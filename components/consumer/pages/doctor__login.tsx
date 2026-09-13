"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthDivider, GoogleButton } from "@/components/consumer/auth/GoogleButton";
import { AuthFooterLink, AuthHeading, AuthLayout } from "@/components/consumer/layout/AuthLayout";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { assets } from "@/lib/consumer/assets";
import {
  canSendDoctorOtp,
  checkDoctorEligibility,
} from "@/lib/consumer/features/doctor-eligibility";

function readError(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && "message" in json) {
    const message = (json as { message?: string }).message;
    if (message) return message;
  }
  return fallback;
}

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
      if (!res.ok) throw new Error(readError(json, "Could not sign in"));
      router.replace("/dashboard");
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
      const eligibility = await checkDoctorEligibility(phone);
      if (!canSendDoctorOtp(eligibility.status)) {
        setError(eligibility.message);
        return;
      }

      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "login" }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error(readError(json, "Failed to send OTP"));
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
        body: JSON.stringify({ id_token: idToken }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error(readError(json, "Google sign-in failed"));
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <AuthLayout blurb="VersaLife for doctors. Manage availability, consult patients, and grow your practice.">
      <div className="flex w-full flex-col gap-6">
        <AuthHeading
          title={
            <>
              <p>Doctor</p>
              <p>sign in</p>
            </>
          }
          subtitle="Use the email and password from your application, Google, or your registered mobile number."
        />
        <GoogleButton onCredential={onGoogle} disabled={busy} />
        <form onSubmit={onEmail} className="flex w-full flex-col gap-4">
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
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <Button type="submit" fullWidth busy={loading === "email"} disabled={busy}>
            {loading === "email" ? "Signing in…" : "Sign in with email"}
          </Button>
        </form>
        <AuthDivider label="or use mobile" />
        <form onSubmit={onOtp} className="flex w-full flex-col gap-4">
          <Input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+9477XXXXXXX"
          />
          <Button type="submit" fullWidth busy={loading === "otp"} disabled={busy} icon={assets.phoneIcon} iconAlt="">
            {loading === "otp" ? "Sending…" : "Send OTP"}
          </Button>
        </form>
        {error ? <p className="text-body-sm text-danger">{error}</p> : null}
        <AuthFooterLink text="New here?" linkText="Register as a doctor" href="/register" />
      </div>
    </AuthLayout>
  );
}
