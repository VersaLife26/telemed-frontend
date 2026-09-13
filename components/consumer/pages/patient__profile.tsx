"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/consumer/ui/Card";
import { Button } from "@/components/consumer/ui/Button";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { Input } from "@/components/consumer/ui/Input";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { ProfileSkeleton } from "@/components/consumer/ui/skeletons";
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
  const [signingOut, setSigningOut] = useState(false);

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
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } finally {
      setSigningOut(false);
    }
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
    return <ProfileSkeleton />;
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in to view your profile"
        body={error || "Your name and contact details live here after you sign in."}
        action={{ href: "/login", label: "Sign in" }}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header>
        <h1 className="text-h3 text-ink">Profile</h1>
        <p className="mt-1 text-body text-text-muted">How this account appears on visits.</p>
      </header>
      <Card className="flex flex-col gap-5">
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-caption text-text-label">Name</span>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              autoComplete="name"
              required
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-caption text-text-label">Phone</span>
            <Input
              type="tel"
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              autoComplete="tel"
              placeholder="0771234567"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-caption text-text-label">Address</span>
            <Textarea
              value={draft.address}
              onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
              autoComplete="street-address"
              rows={3}
              maxLength={500}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-caption text-text-label">Date of birth</span>
            <Input
              type="date"
              value={draft.dateOfBirth}
              onChange={(e) => setDraft((d) => ({ ...d, dateOfBirth: e.target.value }))}
              autoComplete="bday"
            />
          </label>
          {notice ? <p className="text-body-sm text-primary">{notice}</p> : null}
          {error ? <p className="text-body-sm text-danger">{error}</p> : null}
          <Button type="submit" fullWidth busy={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </form>
        <Button type="button" variant="outline" fullWidth busy={signingOut} onClick={() => void logout()}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
