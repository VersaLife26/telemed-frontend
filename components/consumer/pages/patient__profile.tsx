"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { browserApi } from "@/lib/consumer/api/client";
import type { TelemedUser } from "@/lib/consumer/api/types";
import {
  profileDraftFromUser,
  profileUpdateBody,
  profileUpdateError,
  type ProfileDraft,
} from "@/lib/consumer/features/profile";

const emptyDraft: ProfileDraft = { name: "", phone: "", address: "", dateOfBirth: "" };

export default function ProfilePage() {
  const [user, setUser] = useState<TelemedUser | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    browserApi<TelemedUser>("/users/me")
      .then((account) => {
        setUser(account);
        setDraft(profileDraftFromUser(account));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Sign in required"))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const invalid = profileUpdateError(draft);
    if (invalid) {
      setError(invalid);
      setNotice(null);
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await browserApi<TelemedUser>("/users/me", {
        method: "PUT",
        body: profileUpdateBody(user, draft),
      });
      setUser(updated);
      setDraft(profileDraftFromUser(updated));
      setNotice("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-body text-text-muted">Loading profile…</p>;
  }

  if (!user) {
    return (
      <Card className="flex flex-col gap-4">
        <p className="text-body text-text-muted">{error || "Sign in to view your profile."}</p>
        <Link href="/login" className="max-w-xs">
          <Button>Sign in</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="flex max-w-xl flex-col gap-4">
      <h1 className="text-h4 text-black">Profile</h1>
      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-body-sm text-text-label">Name</span>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            autoComplete="name"
            required
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-body-sm text-text-label">Phone</span>
          <Input
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            autoComplete="tel"
            placeholder="0771234567"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-body-sm text-text-label">Address</span>
          <textarea
            value={draft.address}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            autoComplete="street-address"
            rows={3}
            maxLength={500}
            className="w-full rounded-[32px] bg-white px-6 py-3 text-[16px] font-light leading-[1.4] text-black shadow-[var(--shadow-soft)] outline-none placeholder:text-text-placeholder"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-body-sm text-text-label">Date of birth</span>
          <Input
            type="date"
            value={draft.dateOfBirth}
            onChange={(e) => setDraft((d) => ({ ...d, dateOfBirth: e.target.value }))}
            autoComplete="bday"
          />
        </label>
        {notice ? <p className="text-body-sm text-primary">{notice}</p> : null}
        {error ? <p className="text-body-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>
      <Button type="button" variant="outline" onClick={() => void logout()}>
        Sign out
      </Button>
    </Card>
  );
}
