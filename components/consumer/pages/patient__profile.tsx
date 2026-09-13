"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/consumer/ui/Card";
import { Button } from "@/components/consumer/ui/Button";
import { EmptyState } from "@/components/consumer/ui/EmptyState";
import { Input } from "@/components/consumer/ui/Input";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { ProfileSkeleton } from "@/components/consumer/ui/skeletons";
import { browserApi } from "@/lib/consumer/api/client";
import type { TelemedUser } from "@/lib/consumer/api/types";
import { assets } from "@/lib/consumer/assets";
import {
  profileDraftFromUser,
  profilePhotoError,
  profilePhotoSrc,
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
  const [photoBusy, setPhotoBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    browserApi<TelemedUser>("/users/me")
      .then((account) => {
        setUser(account);
        setDraft(profileDraftFromUser(account));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Sign in required"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  async function onPhotoSelected(file: File | null) {
    const invalid = profilePhotoError(file);
    if (invalid || !file) {
      setError(invalid);
      setNotice(null);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPhotoBusy(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const updated = await browserApi<TelemedUser>("/users/me/photo", {
        method: "PUT",
        body: form,
      });
      setUser(updated);
      setNotice("Profile photo updated.");
      window.dispatchEvent(new CustomEvent("telemed:profile-updated", { detail: updated }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await browserApi<TelemedUser>("/users/me/photo", { method: "DELETE" });
      setUser(updated);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setNotice("Profile photo removed.");
      window.dispatchEvent(new CustomEvent("telemed:profile-updated", { detail: updated }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setPhotoBusy(false);
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

  const photoSrc = previewUrl || profilePhotoSrc(user.photo_url) || assets.avatarPlaceholder;
  const hasStoredPhoto = Boolean(user.photo_url) || Boolean(previewUrl);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header>
        <h1 className="text-h3 text-ink">Profile</h1>
        <p className="mt-1 text-body text-text-muted">How this account appears on visits.</p>
      </header>
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-full border-2 border-primary bg-linen">
            <Image
              src={photoSrc}
              alt=""
              fill
              className="object-cover"
              unoptimized={Boolean(previewUrl || user.photo_url)}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 text-center sm:text-left">
            <p className="text-body-sm text-text-muted">JPEG, PNG or WebP · up to 2 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => void onPhotoSelected(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button
                type="button"
                variant="secondary"
                busy={photoBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {hasStoredPhoto ? "Change photo" : "Upload photo"}
              </Button>
              {hasStoredPhoto ? (
                <Button type="button" variant="outline" busy={photoBusy} onClick={() => void removePhoto()}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>

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
