"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/consumer/ui/Card";
import { LogOut } from "lucide-react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { Button, ButtonLink } from "@/components/consumer/ui/Button";
import { Select } from "@/components/consumer/ui/Select";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { Input } from "@/components/consumer/ui/Input";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { browserApi } from "@/lib/consumer/api/client";
import type { Doctor, TelemedUser } from "@/lib/consumer/api/types";
import {
  CREDENTIAL_DOC_TYPES,
  PRACTICE_LANGUAGES,
  consultLanguages,
  doctorFeeCents,
  documentMetadataBody,
  practiceProfileBody,
} from "@/lib/consumer/features/practice";
import { PageHero } from "@/components/consumer/ui/PageHero";
import { HEROES } from "@/lib/consumer/heroes";

export default function ProfilePage() {
  const [me, setMe] = useState<Doctor | null>(null);
  const [user, setUser] = useState<TelemedUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [feeRupees, setFeeRupees] = useState("");
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [experienceYears, setExperienceYears] = useState(0);
  const [docType, setDocType] = useState<(typeof CREDENTIAL_DOC_TYPES)[number]["value"]>(
    "slmc_certificate",
  );
  const [docFilename, setDocFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"email" | "password" | "practice" | "document" | null>(
    null,
  );

  useEffect(() => {
    Promise.all([browserApi<Doctor>("/doctors/me"), browserApi<TelemedUser>("/users/me")])
      .then(([doctor, account]) => {
        setMe(doctor);
        setUser(account);
        setEmail(account.email || "");
        setBio(doctor.bio || "");
        setFeeRupees(String(doctorFeeCents(doctor) / 100));
        setLanguages(consultLanguages(doctor.languages));
        setExperienceYears(doctor.experience_years ?? 0);
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
      const updated = await browserApi<Doctor>("/doctors/me", {
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
      setExperienceYears(updated.experience_years ?? experienceYears);
      setNotice("Practice profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save practice profile");
    } finally {
      setSaving(null);
    }
  }

  async function saveDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!docFilename.trim()) {
      setError("Filename is required. Bytes are not uploaded here — only metadata.");
      return;
    }
    setSaving("document");
    setNotice(null);
    setError(null);
    try {
      await browserApi("/doctors/me/documents", {
        method: "POST",
        body: documentMetadataBody(docType, docFilename),
      });
      setDocFilename("");
      setNotice("Document metadata recorded. Object storage still holds the file bytes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record document");
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

  return (
    <div className="flex flex-col gap-10">
      <PageHero
        {...HEROES.doctorProfile}
        eyebrow={me?.specialty || HEROES.doctorProfile.eyebrow}
        title={me?.display_name || "Doctor"}
      >
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">SLMC {me?.slmc_number || "—"}</Badge>
          <Badge tone={me?.verification_status === "approved" ? "success" : "warning"}>
            {me?.verification_status || "unverified"}
          </Badge>
        </div>
      </PageHero>
      <div className="flex w-full max-w-xl flex-col gap-6">

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

      <Card>
        <h2 className="text-h4 text-ink">Credential documents</h2>
        <p className="mt-1 text-body-sm text-muted">
          Records document type and filename only. File bytes are not sent on this call.
        </p>
        <form onSubmit={(e) => void saveDocument(e)} className="mt-5 flex flex-col gap-5">
          <Select
            id="doc-type"
            label="Document type"
            value={docType}
            onChange={(e) =>
              setDocType(e.target.value as (typeof CREDENTIAL_DOC_TYPES)[number]["value"])
            }
          >
            {CREDENTIAL_DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <Input
            id="doc-filename"
            label="Filename"
            value={docFilename}
            onChange={(e) => setDocFilename(e.target.value)}
            placeholder="slmc-certificate.pdf"
          />
          <Button
            type="submit"
            variant="outline"
            fullWidth
            busy={saving === "document"}
            disabled={saving !== null}
          >
            Record document
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-h4 text-ink">Sign-in details</h2>

        <form onSubmit={(e) => void saveEmail(e)} className="mt-5 flex flex-col gap-4">
          <Input
            id="doctor-email"
            label="Login email"
            hint="Used for Google and email sign-in."
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.lk"
          />
          <Button type="submit" fullWidth busy={saving === "email"} disabled={saving !== null}>
            Save email
          </Button>
        </form>

        <form onSubmit={(e) => void savePassword(e)} className="mt-6 flex flex-col gap-4">
          <Input
            id="doctor-password"
            label="Set a password"
            hint="At least 8 characters."
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
