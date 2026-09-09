"use client";

import { useState } from "react";
import { AuthFooterLink, AuthHeading, AuthLayout } from "@/components/consumer/layout/AuthLayout";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { parseEnvelope } from "@/lib/consumer/api/envelope";

const SPECIALTIES = [
  { code: "general_practice", label: "General Practitioner" },
  { code: "pediatrics", label: "Pediatrics" },
  { code: "obstetrics_gynae", label: "Obstetrics & Gynaecology" },
  { code: "cardiology", label: "Cardiology" },
  { code: "dermatology", label: "Dermatology" },
  { code: "endocrinology", label: "Endocrinology & Diabetes" },
  { code: "ent", label: "ENT (Ear, Nose & Throat)" },
  { code: "psychiatry", label: "Psychiatry" },
  { code: "psychology", label: "Psychology & Counselling" },
  { code: "orthopedics", label: "Orthopedics" },
  { code: "ophthalmology", label: "Ophthalmology (Eye Care)" },
  { code: "neurology", label: "Neurology" },
  { code: "gastroenterology", label: "Gastroenterology" },
  { code: "nephrology", label: "Nephrology" },
  { code: "urology", label: "Urology" },
  { code: "pulmonology", label: "Pulmonology (Chest/Lung)" },
  { code: "general_surgery", label: "General Surgery" },
  { code: "dental", label: "Dental" },
  { code: "nutrition", label: "Nutrition & Dietetics" },
] as const;

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "si", label: "Sinhala" },
  { code: "ta", label: "Tamil" },
] as const;

const selectClass =
  "w-full rounded-[32px] bg-white px-6 py-3 text-[16px] font-light leading-[1.4] text-black shadow-[var(--shadow-soft)] outline-none border border-transparent focus:border-primary-light appearance-none";

function readError(json: unknown, fallback: string): string {
  if (json && typeof json === "object" && "message" in json) {
    const message = (json as { message?: string }).message;
    if (message) return message;
  }
  return fallback;
}

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [slmcNumber, setSlmcNumber] = useState("");
  const [specialty, setSpecialty] = useState("general_practice");
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [experienceYears, setExperienceYears] = useState("");
  const [feeLkr, setFeeLkr] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function toggleLanguage(code: string) {
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (languages.length === 0) {
      setError("Select at least one language.");
      return;
    }

    const years = Number(experienceYears);
    const feeRupees = Number(feeLkr);
    if (!Number.isFinite(years) || years < 0 || years > 70) {
      setError("Experience years must be between 0 and 70.");
      return;
    }
    if (!Number.isFinite(feeRupees) || feeRupees < 0) {
      setError("Consultation fee must be a valid amount in LKR.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/proxy/doctors/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          slmc_number: slmcNumber.trim(),
          specialty,
          languages,
          experience_years: Math.floor(years),
          // Wire field is fee_lkr but the value is cents.
          fee_lkr: Math.round(feeRupees * 100),
          bio: bio.trim(),
        }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(readError(json, "Could not submit application"));
      parseEnvelope(json);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit application");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout blurb="VersaLife for doctors. Apply to join the network — after approval you can sign in with OTP.">
      <div className="flex w-full flex-col gap-6">
        <AuthHeading
          title={
            <>
              <p>Doctor</p>
              <p>registration</p>
            </>
          }
          subtitle={
            submitted
              ? undefined
              : "Tell us about your practice. An admin will review your application."
          }
        />

        {submitted ? (
          <div className="flex w-full flex-col gap-6">
            <p className="text-body text-text-muted">
              Your application has been received and is under review. After approval you will get
              an email, then you can sign in with OTP.
            </p>
            <AuthFooterLink text="Ready to continue?" linkText="Back to sign in" href="/login" />
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
              <Input
                type="text"
                required
                minLength={2}
                maxLength={200}
                focused
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                autoComplete="name"
              />
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
              />
              <Input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+9477XXXXXXX"
                autoComplete="tel"
              />
              <Input
                type="text"
                required
                value={slmcNumber}
                onChange={(e) => setSlmcNumber(e.target.value)}
                placeholder="SLMC number"
              />
              <label className="flex w-full flex-col gap-2">
                <span className="text-body-sm text-text-label">Specialty</span>
                <select
                  className={selectClass}
                  required
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                >
                  {SPECIALTIES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="flex w-full flex-col gap-2">
                <legend className="text-body-sm text-text-label">Languages</legend>
                <div className="flex flex-wrap gap-4 px-1">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <label
                      key={lang.code}
                      className="inline-flex cursor-pointer items-center gap-2 text-body text-black"
                    >
                      <input
                        type="checkbox"
                        checked={languages.includes(lang.code)}
                        onChange={() => toggleLanguage(lang.code)}
                        className="size-4 accent-[var(--color-primary)]"
                      />
                      {lang.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Input
                type="number"
                required
                min={0}
                max={70}
                step={1}
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                placeholder="Years of experience"
              />
              <Input
                type="number"
                required
                min={0}
                step={1}
                value={feeLkr}
                onChange={(e) => setFeeLkr(e.target.value)}
                placeholder="Consultation fee (LKR)"
              />
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Bio (optional)"
                maxLength={2000}
                rows={3}
              />
              {error ? <p className="text-body-sm text-danger">{error}</p> : null}
              <Button type="submit" disabled={loading}>
                {loading ? "Submitting…" : "Submit application"}
              </Button>
            </form>
            <AuthFooterLink text="Already approved?" linkText="Sign in" href="/login" />
          </>
        )}
      </div>
    </AuthLayout>
  );
}
