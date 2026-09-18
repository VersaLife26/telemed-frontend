"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/consumer/layout/AppShell";
import { Button } from "@/components/consumer/ui/Button";
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
    <div className="flex max-w-xl flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <h1 className="text-h4 text-black">{me?.display_name || "Doctor"}</h1>
        <p className="text-body text-text-muted">{me?.specialty}</p>
        <p className="text-body-sm text-text-label">SLMC {me?.slmc_number || "—"}</p>
        <p className="text-body-sm text-text-label">Status: {me?.verification_status || "—"}</p>

        <form onSubmit={(e) => void savePractice(e)} className="flex flex-col gap-3">
          <label className="text-body-sm text-text-label">Bio</label>
          <Textarea
            maxLength={2000}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What patients should know about your practice"
          />
          <label className="text-body-sm text-text-label">Consultation fee (LKR)</label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={feeRupees}
            onChange={(e) => setFeeRupees(e.target.value)}
          />
          <label className="text-body-sm text-text-label">Years of experience</label>
          <Input
            type="number"
            min={0}
            max={70}
            value={experienceYears}
            onChange={(e) => setExperienceYears(Number(e.target.value) || 0)}
          />
          <p className="text-body-sm text-text-label">Languages</p>
          <div className="flex flex-wrap gap-3">
            {PRACTICE_LANGUAGES.map((lang) => (
              <label key={lang.code} className="flex items-center gap-2 text-body-sm text-black">
                <input
                  type="checkbox"
                  checked={languages.includes(lang.code)}
                  onChange={() => toggleLanguage(lang.code)}
                />
                {lang.label}
              </label>
            ))}
          </div>
          <Button type="submit" fullWidth disabled={saving !== null}>
            {saving === "practice" ? "Saving…" : "Save practice profile"}
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-h5 text-black">Credential documents</h2>
        <p className="text-body-sm text-text-muted">
          Records document type and filename only. File bytes are not sent on this call.
        </p>
        <form onSubmit={(e) => void saveDocument(e)} className="flex flex-col gap-3">
          <select
            className="min-h-12 rounded-[32px] border border-transparent bg-paper px-6 text-[16px]"
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
          </select>
          <Input
            value={docFilename}
            onChange={(e) => setDocFilename(e.target.value)}
            placeholder="slmc-certificate.pdf"
          />
          <Button type="submit" variant="outline" fullWidth disabled={saving !== null}>
            {saving === "document" ? "Saving…" : "Record document"}
          </Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-4">
        <form onSubmit={(e) => void saveEmail(e)} className="flex flex-col gap-3">
          <label className="text-body-sm text-text-label">
            Login email (for Google and email sign-in)
          </label>
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
    </div>
  );
}
