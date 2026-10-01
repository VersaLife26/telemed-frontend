"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthFooterLink, AuthHeading, AuthLayout } from "@/components/consumer/layout/AuthLayout";
import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { Reveal } from "@/components/consumer/ui/Reveal";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { problemMessage } from "@/lib/consumer/api/errors";

export function ResetPasswordPage({
  title,
  subtitle,
  blurb,
  afterResetHref,
}: {
  title: string;
  subtitle: string;
  blurb?: string;
  afterResetHref: string;
}) {
  return (
    <AuthLayout blurb={blurb}>
      <div className="flex w-full flex-col gap-7">
        <AuthHeading title={title} subtitle={subtitle} />
        <Suspense fallback={<FormSkeleton />}>
          <ResetForm afterResetHref={afterResetHref} />
        </Suspense>
      </div>
    </AuthLayout>
  );
}

function ResetForm({ afterResetHref }: { afterResetHref: string }) {
  const router = useRouter();
  const token = useSearchParams().get("token")?.trim() ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(problemMessage(json, "Could not reset password"));
      router.replace(afterResetHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Reveal delay={1} className="flex flex-col gap-7">
        <Alert tone="danger" title="This reset link is incomplete">
          Request a new password-reset email and use the link from that message.
        </Alert>
        <AuthFooterLink text="Need a new link?" linkText="Forgot password" href="/login/forgot" />
      </Reveal>
    );
  }

  return (
    <Reveal delay={1} className="flex flex-col gap-7">
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
        <Input
          id="reset-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
        <Input
          id="reset-password-confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" size="lg" fullWidth busy={loading} disabled={loading}>
          {loading ? "Saving…" : "Save new password"}
        </Button>
      </form>
      <AuthFooterLink text="Remembered it?" linkText="Back to sign in" href="/login" />
    </Reveal>
  );
}
