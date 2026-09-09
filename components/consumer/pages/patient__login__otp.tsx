"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthHeading, AuthLayout } from "@/components/consumer/layout/AuthLayout";
import { Button } from "@/components/consumer/ui/Button";
import { OtpInput } from "@/components/consumer/ui/OtpInput";

const RESEND_COOLDOWN_SEC = 30;

function readError(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && "message" in json) {
    const message = (json as { message?: string }).message;
    if (message) return message;
  }
  return fallback;
}

function OtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const phone = params.get("phone") || "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: code, purpose: "login" }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error(readError(json, "Invalid OTP"));
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!phone || cooldown > 0 || resending || loading) return;
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "login" }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error(readError(json, "Could not resend code"));
      setCode("");
      setCooldown(RESEND_COOLDOWN_SEC);
      setInfo("A new code was sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout>
      <div className="flex w-full max-w-[580px] flex-col gap-6">
        <AuthHeading
          title={
            <>
              <p>Enter the</p>
              <p>verification code</p>
            </>
          }
          subtitle={`Code sent to ${phone || "your phone"}`}
        />
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <OtpInput length={6} value={code} onChange={setCode} />
          {error ? <p className="text-body-sm text-danger">{error}</p> : null}
          {info ? <p className="text-body-sm text-primary">{info}</p> : null}
          <Button type="submit" disabled={loading || resending || code.length < 6}>
            {loading ? "Verifying…" : "Verify & continue"}
          </Button>
        </form>
        <div className="flex w-full flex-col items-center gap-3 text-center">
          <button
            type="button"
            onClick={() => void onResend()}
            disabled={!phone || cooldown > 0 || resending || loading}
            className={`text-body ${
              !phone || cooldown > 0 || resending || loading
                ? "cursor-not-allowed text-text-muted opacity-60"
                : "cursor-pointer text-primary"
            }`}
          >
            {resending
              ? "Sending…"
              : cooldown > 0
                ? `Resend code in ${cooldown}s`
                : "Resend code"}
          </button>
          <p className="text-body text-text-muted">
            Wrong number?{" "}
            <Link href="/login" className="text-primary">
              Change phone
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function OtpPage() {
  return (
    <Suspense fallback={<div className="p-8 text-body text-text-muted">Loading…</div>}>
      <OtpForm />
    </Suspense>
  );
}
