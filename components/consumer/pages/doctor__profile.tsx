"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";

import { Card } from "@/components/consumer/ui/Card";
import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { Button, ButtonLink } from "@/components/consumer/ui/Button";
import { Select } from "@/components/consumer/ui/Select";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { Input } from "@/components/consumer/ui/Input";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { browserApi } from "@/lib/consumer/api/client";
import { hasCode, problemMessage } from "@/lib/consumer/api/errors";
import type { DoctorDocumentType, DoctorProfile, Specialty, TelemedUser } from "@/lib/consumer/api/types";
import { assets } from "@/lib/consumer/assets";
import {
  CREDENTIAL_DOC_TYPES,
  PRACTICE_LANGUAGES,
  apiFileSrc,
  consultLanguages,
  doctorFeeCents,
  credentialDocumentError,
  practiceProfileBody,
} from "@/lib/consumer/features/practice";
import { specialtyLabel } from "@/lib/consumer/features/doctor-search";
import { profilePhotoError } from "@/lib/consumer/features/profile";
import { SignatureCard } from "@/components/consumer/signature-card";
import { PageHero } from "@/components/consumer/ui/PageHero";
import { HEROES } from "@/lib/consumer/heroes";

export default function ProfilePage() {
  const [me, setMe] = useState<DoctorProfile | null>(null);
  const [user, setUser] = useState<TelemedUser | null>(null);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [feeRupees, setFeeRupees] = useState("");
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [experienceYears, setExperienceYears] = useState(0);
  const [docType, setDocType] = useState<DoctorDocumentType>("slmcCertificate");
  const [docFile, setDocFile] = useState<File | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"password" | "practice" | "document" | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    browserApi<Specialty[]>("/specialties")
      .then(setSpecialties)
      .catch(() => undefined);
    Promise.all([browserApi<DoctorProfile>("/doctors/me"), browserApi<TelemedUser>("/me")])
      .then(([doctor, account]) => {
        setMe(doctor);
        setUser(account);
        setBio(doctor.bio || "");
        setFeeRupees(String(doctorFeeCents(doctor) / 100));
        setLanguages(consultLanguages(doctor.languages));
        setExperienceYears(doctor.experienceYears ?? 0);
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
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSaving("password");
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: user?.hasPassword ? currentPassword : null,
          newPassword: password,
        }),
      });
      if (!res.ok) {
        throw new Error(problemMessage(await res.json().catch(() => null), "Could not save password"));
      }
      setPassword("");
      setCurrentPassword("");
      setUser((prev) => (prev ? { ...prev, hasPassword: true } : prev));
      setNotice("Password saved. Other devices have been signed out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save password");
    } finally {
      setSaving(null);
    }
  }

  async function savePractice(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    if (languages.length === 0) {
      setError("Select at least one consultation language.");
      return;
    }
    setSaving("practice");
    setNotice(null);
    setError(null);
    try {
      const updated = await browserApi<DoctorProfile>("/doctors/me", {
        method: "PUT",
        body: practiceProfileBody(me, {
          bio,
          feeRupees: Number(feeRupees) || 0,
          languages,
          experienceYears,
        }),
      });
      setMe(updated);
      setBio(updated.bio || "");
      setFeeRupees(String(doctorFeeCents(updated) / 100));
      setLanguages(updated.languages?.length ? updated.languages : languages);
      setExperienceYears(updated.experienceYears ?? experienceYears);
      setNotice("Practice profile saved.");
    } catch (err) {
      setError(
        hasCode(err, "concurrency_conflict")
          ? "Your profile was changed elsewhere. Reload the page and try again."
          : err instanceof Error
            ? err.message
            : "Could not save practice profile",
      );
    } finally {
      setSaving(null);
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
      const updated = await browserApi<DoctorProfile>("/doctors/me/photo", {
        method: "PUT",
        body: form,
      });
      setMe(updated);
      setNotice("Profile photo updated. Patients will see this in the directory.");
      window.dispatchEvent(new CustomEvent("telemed:doctor-profile-updated", { detail: updated }));
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
      await browserApi("/doctors/me/photo", { method: "DELETE" });
      const updated = { ...me, photoUrl: null };
      setMe(updated);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setNotice("Profile photo removed.");
      window.dispatchEvent(new CustomEvent("telemed:doctor-profile-updated", { detail: updated }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function saveDocument(e: React.FormEvent) {
    e.preventDefault();
    const invalid = credentialDocumentError(docFile);
    if (invalid || !docFile) {
      setError(invalid);
      setNotice(null);
      return;
    }
    setSaving("document");
    setNotice(null);
    setError(null);
    try {
      const form = new FormData();
      form.append("type", docType);
      form.append("file", docFile);
      await browserApi("/doctors/me/documents", { method: "POST", body: form });
      setDocFile(null);
      if (docInputRef.current) docInputRef.current.value = "";
      setNotice("Document uploaded for review.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload document");
    } finally {
      setSaving(null);
    }
  }

  function toggleLanguage(code: string) {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-10">
        <PageHero {...HEROES.doctorProfile} />
        <div className="w-full max-w-xl">
          <FormSkeleton />
        </div>
      </div>
    );
  }

  if (error && !me) {
    return (
      <Card className="flex max-w-xl flex-col items-start gap-4">
        <p className="text-body text-muted">{error || "Sign in required"}</p>
        <ButtonLink href="/login">Sign in</ButtonLink>
      </Card>
    );
  }

  const photoSrc = previewUrl || apiFileSrc(me?.photoUrl) || assets.avatarPlaceholder;
  const hasStoredPhoto = Boolean(me?.photoUrl) || Boolean(previewUrl);

  return (
    <div className="flex flex-col gap-10">
      <PageHero
        {...HEROES.doctorProfile}
        eyebrow={me?.specialtyCode ? specialtyLabel(me.specialtyCode, specialties) : HEROES.doctorProfile.eyebrow}
        title={me?.displayName || "Doctor"}
        image={photoSrc}
        imageAlt={me?.displayName || "Your profile photo"}
        framed
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">SLMC {me?.slmcNumber || "—"}</Badge>
          <Badge tone={me?.status === "suspended" ? "warning" : "success"}>
            {me?.status === "suspended" ? "Suspended" : "Active"}
          </Badge>
        </div>
      </PageHero>
      <div className="flex w-full max-w-xl flex-col gap-6">

      <section className="overflow-hidden rounded-xl bg-[image:var(--gradient-hero)] p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-full bg-surface shadow-md ring-4 ring-white/70">
            <Image
              src={photoSrc}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3 text-center sm:text-left">
            <div>
              <p className="text-h4 text-ink">Directory photo</p>
              <p className="mt-0.5 text-body-sm text-blue-800">
                JPEG, PNG or WebP · up to 2 MB. This is how patients see you.
              </p>
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
                disabled={saving !== null}
                onClick={() => fileInputRef.current?.click()}
              >
                {hasStoredPhoto ? "Change photo" : "Upload photo"}
              </Button>
              {hasStoredPhoto ? (
                <Button
                  size="sm"
                  variant="glass"
                  busy={photoBusy}
                  disabled={saving !== null}
                  onClick={() => void removePhoto()}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <Card>
        <h2 className="text-h4 text-ink">Practice profile</h2>
        <form onSubmit={(e) => void savePractice(e)} className="mt-5 flex flex-col gap-5">
          <Textarea
            id="doctor-bio"
            label="Bio"
            maxLength={2000}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What patients should know about your practice"
          />
          <Input
            id="doctor-fee"
            label="Consultation fee (LKR)"
            type="number"
            min={0}
            step="0.01"
            value={feeRupees}
            onChange={(e) => setFeeRupees(e.target.value)}
          />
          <Input
            id="doctor-experience"
            label="Years of experience"
            type="number"
            min={0}
            max={70}
            value={experienceYears}
            onChange={(e) => setExperienceYears(Number(e.target.value) || 0)}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="text-label text-ink">Consultation languages</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {PRACTICE_LANGUAGES.map((lang) => {
                const on = languages.includes(lang.code);
                return (
                  <label
                    key={lang.code}
                    className={
                      on
                        ? "inline-flex min-h-10 cursor-pointer items-center rounded-pill bg-brand px-4 text-label text-on-brand transition-[background-color,color] duration-[160ms] ease-out"
                        : "inline-flex min-h-10 cursor-pointer items-center rounded-pill border border-border-default px-4 text-label text-muted transition-[background-color,border-color,color] duration-[160ms] ease-out can-hover:hover:border-brand can-hover:hover:text-ink"
                    }
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => toggleLanguage(lang.code)}
                    />
                    {lang.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Button type="submit" size="lg" fullWidth busy={saving === "practice"} disabled={saving !== null}>
            Save practice profile
          </Button>
        </form>
      </Card>

      <SignatureCard />

      <Card>
        <h2 className="text-h4 text-ink">Credential documents</h2>
        <p className="mt-1 text-body-sm text-muted">
          Upload certificates for the verification team. PDF, JPEG or PNG, up to 5 MB each.
        </p>
        <form onSubmit={(e) => void saveDocument(e)} className="mt-5 flex flex-col gap-5">
          <Select
            id="doc-type"
            label="Document type"
            value={docType}
            onChange={(e) => setDocType(e.target.value as DoctorDocumentType)}
          >
            {CREDENTIAL_DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-1.5">
            <span className="text-label text-ink">File</span>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()}>
                {docFile ? "Choose another" : "Choose file"}
              </Button>
              <span className="min-w-0 truncate text-body-sm text-muted">{docFile?.name || "No file chosen"}</span>
            </div>
            <input
              ref={docInputRef}
              id="doc-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            fullWidth
            busy={saving === "document"}
            disabled={saving !== null}
          >
            Upload document
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-h4 text-ink">Sign-in details</h2>

        {user?.email ? (
          <p className="mt-2 text-body-sm text-muted">
            Login email: <span className="font-semibold text-ink">{user.email}</span>
          </p>
        ) : null}

        <form onSubmit={(e) => void savePassword(e)} className="mt-5 flex flex-col gap-4">
          {user?.hasPassword ? (
            <Input
              id="doctor-current-password"
              label="Current password"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          ) : null}
          <Input
            id="doctor-password"
            label={user?.hasPassword ? "New password" : "Set a password"}
            hint="At least 8 characters. Other devices are signed out."
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Button type="submit" fullWidth busy={saving === "password"} disabled={saving !== null}>
            Save password
          </Button>
        </form>

        {notice ? <Alert tone="success" className="mt-5">{notice}</Alert> : null}
        {error ? <Alert tone="danger" className="mt-5">{error}</Alert> : null}
      </Card>

      <Button variant="ghost" fullWidth leading={<LogOut className="size-4" />} onClick={() => void logout()}>
        Sign out
      </Button>
      </div>
    </div>
  );
}
