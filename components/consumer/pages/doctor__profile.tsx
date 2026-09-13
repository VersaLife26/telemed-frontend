"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { browserApi } from "@/lib/consumer/api/client";
import type { Doctor, TelemedUser } from "@/lib/consumer/api/types";

export default function ProfilePage() {
  const [me, setMe] = useState<Doctor | null>(null);
  const [user, setUser] = useState<TelemedUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"email" | "password" | null>(null);

  useEffect(() => {
    Promise.all([browserApi<Doctor>("/doctors/me"), browserApi<TelemedUser>("/users/me")])
      .then(([doctor, account]) => {
        setMe(doctor);
        setUser(account);
        setEmail(account.email || "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Sign in required"))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving("email");
    setNotice(null);
    setError(null);
    try {
      const updated = await browserApi<TelemedUser>("/users/me", {
        method: "PUT",
        body: {
          name: user.name || me?.display_name || "Doctor",
          email: email.trim() || undefined,
          language: user.language || "en",
          version: user.version ?? 0,
        },
      });
      setUser(updated);
      setEmail(updated.email || email);
      setNotice("Email saved. You can now sign in with Google using this address.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save email");
    } finally {
      setSaving(null);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSaving("password");
    setNotice(null);
    setError(null);
    try {
      await browserApi<void>("/users/me/password", {
        method: "PUT",
        body: { new_password: password },
      });
      setPassword("");
      setNotice("Password saved. You can sign in with email next time.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save password");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <p className="text-body text-text-muted">Loading…</p>;

  if (error && !me) {
    return (
      <Card className="flex flex-col gap-4">
        <p className="text-body text-text-muted">{error || "Sign in required"}</p>
        <Link href="/login" className="max-w-xs">
          <Button fullWidth>Sign in</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="flex max-w-xl flex-col gap-4">
      <h1 className="text-h4 text-black">{me?.display_name || "Doctor"}</h1>
      <p className="text-body text-text-muted">{me?.specialty}</p>
      <p className="text-body-sm text-text-label">SLMC {me?.slmc_number || "—"}</p>
      <p className="text-body-sm text-text-label">Status: {me?.verification_status || "—"}</p>

      <form onSubmit={(e) => void saveEmail(e)} className="flex flex-col gap-3">
        <label className="text-body-sm text-text-label">Login email (for Google and email sign-in)</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.lk"
        />
        <Button type="submit" fullWidth disabled={saving !== null}>
          {saving === "email" ? "Saving…" : "Save email"}
        </Button>
      </form>

      <form onSubmit={(e) => void savePassword(e)} className="flex flex-col gap-3">
        <label className="text-body-sm text-text-label">Set a password</label>
        <Input
          type="password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (8+ characters)"
        />
        <Button type="submit" fullWidth disabled={saving !== null}>
          {saving === "password" ? "Saving…" : "Save password"}
        </Button>
      </form>

      {notice ? <p className="text-body-sm text-primary">{notice}</p> : null}
      {error ? <p className="text-body-sm text-danger">{error}</p> : null}

      <Button type="button" variant="outline" fullWidth onClick={() => void logout()}>
        Sign out
      </Button>
    </Card>
  );
}
