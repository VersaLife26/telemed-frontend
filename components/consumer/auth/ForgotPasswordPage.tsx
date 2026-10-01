"use client";

import { useState } from "react";

import { AuthFooterLink, AuthHeading, AuthLayout } from "@/components/consumer/layout/AuthLayout";
import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { Reveal } from "@/components/consumer/ui/Reveal";
import { problemMessage } from "@/lib/consumer/api/errors";

export function ForgotPasswordPage({
  title,
  subtitle,
  blurb,
}: {
  title: string;
  subtitle: string;
  blurb?: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        throw new Error(problemMessage(await res.json().catch(() => null), "Could not send reset email"));
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout blurb={blurb}>
      <div className="flex w-full flex-col gap-7">
        <AuthHeading title={title} subtitle={subtitle} />
        <Reveal delay={1} className="flex flex-col gap-7">
          {sent ? (
            <Alert tone="success" title="Check your email">
              If an account exists for that address, we sent a link to choose a new password. It expires in 30 minutes.
            </Alert>
          ) : (
            <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
              <Input
                id="forgot-email"
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              {error ? <Alert tone="danger">{error}</Alert> : null}
              <Button type="submit" size="lg" fullWidth busy={loading} disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
          <AuthFooterLink text="Remembered it?" linkText="Back to sign in" href="/login" />
        </Reveal>
      </div>
    </AuthLayout>
  );
}
