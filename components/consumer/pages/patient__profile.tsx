"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { LogOut, UserRound } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
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
import { SexField } from "@/components/consumer/sex-field";
import { PageHero } from "@/components/consumer/ui/PageHero";
import { HEROES } from "@/lib/consumer/heroes";

const emptyDraft: ProfileDraft = { name: "", address: "", dateOfBirth: "", sex: "", allergies: "" };

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
    browserApi<TelemedUser>("/me")
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
      const updated = await browserApi<TelemedUser>("/me", {
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
      const updated = await browserApi<TelemedUser>("/me/photo", {
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
      await browserApi<void>("/me/photo", { method: "DELETE" });
      const updated = await browserApi<TelemedUser>("/me");
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
    return (
      <div className="flex flex-col gap-10">
        <PageHero {...HEROES.profile} />
        <div className="mx-auto w-full max-w-xl">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in to view your profile"
        body={error || "Your name and contact details live here after you sign in."}
        icon={<UserRound className="size-5" />}
        action={{ href: "/login", label: "Sign in" }}
      />
    );
  }

  const photoSrc = previewUrl || profilePhotoSrc(user.photoUrl) || assets.avatarPlaceholder;
  const hasStoredPhoto = Boolean(user.photoUrl) || Boolean(previewUrl);

  return (
    <div className="flex flex-col gap-10">
      <PageHero {...HEROES.profile} />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">

      {/* Identity sits on the gradient, the editable record sits on a card.
          Two planes, because they are two different kinds of thing. */}
      <section className="overflow-hidden rounded-xl bg-[image:var(--gradient-hero)] p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-full bg-surface shadow-md ring-4 ring-white/70">
            <Image
              src={photoSrc}
              alt=""
              fill
              className="object-cover"
              unoptimized={Boolean(previewUrl || user.photoUrl)}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3 text-center sm:text-left">
            <div>
              <p className="text-h4 text-ink">{user.fullName || "Your profile"}</p>
              <p className="mt-0.5 text-body-sm text-blue-800">JPEG, PNG or WebP · up to 5 MB</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => void onPhotoSelected(e.target.files?.[0] ?? null)}
            />

            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button
                size="sm"
                busy={photoBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {hasStoredPhoto ? "Change photo" : "Upload photo"}
              </Button>
              {hasStoredPhoto ? (
                <Button size="sm" variant="glass" busy={photoBusy} onClick={() => void removePhoto()}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <Card>
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-5">
          <Input
            id="profile-name"
            label="Name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            autoComplete="name"
            required
          />
          <Input
            id="profile-sign-in"
            label={user.phoneNumber ? "Phone" : "Email"}
            value={user.phoneNumber || user.email || ""}
            readOnly
            hint="Used to sign in. It cannot be changed here."
          />
          <Textarea
            id="profile-address"
            label="Address"
            value={draft.address}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            autoComplete="street-address"
            rows={3}
            maxLength={500}
          />
          <Input
            id="profile-dob"
            label="Date of birth"
            type="date"
            value={draft.dateOfBirth}
            onChange={(e) => setDraft((d) => ({ ...d, dateOfBirth: e.target.value }))}
            autoComplete="bday"
          />
          <SexField
            id="profile-sex"
            value={draft.sex}
            onChange={(sex) => setDraft((d) => ({ ...d, sex }))}
          />
          <Textarea
            id="profile-allergies"
            label="Known allergies"
            hint="Shared with your doctor when you book. Leave empty if none."
            value={draft.allergies}
            onChange={(e) => setDraft((d) => ({ ...d, allergies: e.target.value }))}
            rows={2}
            maxLength={2000}
          />

          {notice ? <Alert tone="success">{notice}</Alert> : null}
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Button type="submit" size="lg" fullWidth busy={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </Card>

      <Button
        variant="ghost"
        fullWidth
        busy={signingOut}
        leading={<LogOut className="size-4" />}
        onClick={() => void logout()}
      >
        Sign out
      </Button>
      </div>
    </div>
  );
}
