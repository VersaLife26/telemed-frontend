"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthFooterLink, AuthHeading, AuthLayout } from "@/components/consumer/layout/AuthLayout";
import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Input } from "@/components/consumer/ui/Input";
import { Textarea } from "@/components/consumer/ui/Textarea";
import { parseEnvelope } from "@/lib/consumer/api/envelope";
import {
  APPLY_DOCUMENT_TYPES,
  LANGUAGE_OPTIONS,
  SPECIALTIES,
  TERMS_HREF,
  WEEKDAYS,
  applyDocumentPath,
  applyDocuments,
  doctorApplyError,
  doctorApplyPayload,
  readApplyError,
  type ApplyDocumentType,
  type DoctorApplyForm,
} from "@/lib/consumer/features/doctor-apply";

// The application form's own controls, held to the same field chrome as the
// design system's Input so a long form does not read as assembled parts.
const selectClass =
  "min-h-11 w-full appearance-none rounded-md border border-border-default bg-surface px-4 py-3 text-body text-ink outline-none transition-[border-color,box-shadow] duration-[160ms] ease-out focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-tint)]";

const fileClass =
  "w-full rounded-md border border-border-default bg-surface px-4 py-3 text-body-sm text-ink file:mr-4 file:cursor-pointer file:rounded-pill file:border-0 file:bg-brand-tint file:px-4 file:py-1.5 file:text-[13px] file:font-semibold file:text-brand";

const radioClass =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 text-body text-ink";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex w-full flex-col gap-4">
      <legend className="mb-1 text-h5 text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function YesNo({
  name,
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  name: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-4 px-1">
      <label className={radioClass}>
        <input
          type="radio"
          name={name}
          checked={value === true}
          onChange={() => onChange(true)}
          className="size-4 accent-[var(--brand)]"
        />
        {yesLabel}
      </label>
      <label className={radioClass}>
        <input
          type="radio"
          name={name}
          checked={value === false}
          onChange={() => onChange(false)}
          className="size-4 accent-[var(--brand)]"
        />
        {noLabel}
      </label>
    </div>
  );
}

const emptyForm: DoctorApplyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  slmcNumber: "",
  languages: ["en"],
  languageOther: "",
  pgimBoardCertified: null,
  medicalSchool: "",
  qualifications: "",
  consultationMinutes: "30",
  feeLkr: "",
  availableDays: [1, 2, 3, 4, 5],
  availableStart: "09:00",
  availableEnd: "17:00",
  availabilityExtra: "",
  isGeneralPractitioner: null,
  specialty: "general_practice",
  experienceYears: "",
  practicingLocations: "",
  bankName: "",
  bankBranch: "",
  accountNumber: "",
  accountName: "",
  termsAccepted: null,
  signature: null,
  seal: null,
  slmcCertificate: null,
};

export default function RegisterPage() {
  const [form, setForm] = useState<DoctorApplyForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pendingDocs, setPendingDocs] = useState<{
    applicationId: string;
    remaining: ApplyDocumentType[];
  } | null>(null);

  function patch(partial: Partial<DoctorApplyForm>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function toggleLanguage(code: string) {
    setForm((prev) => ({
      ...prev,
      languages: prev.languages.includes(code)
        ? prev.languages.filter((l) => l !== code)
        : [...prev.languages, code],
    }));
  }

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)),
    }));
  }

  function setFile(type: ApplyDocumentType, file: File | null) {
    if (type === "signature") patch({ signature: file });
    else if (type === "seal") patch({ seal: file });
    else patch({ slmcCertificate: file });
  }

  async function uploadDocuments(applicationId: string, docs: { type: ApplyDocumentType; file: File }[]) {
    const failed: ApplyDocumentType[] = [];
    for (const doc of docs) {
      const body = new FormData();
      body.append("file", doc.file);
      body.append("document_type", doc.type);
      const res = await fetch(`/api/proxy${applyDocumentPath(applicationId)}`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        failed.push(doc.type);
      }
    }
    return failed;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const problem = doctorApplyError(form);
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    try {
      let applicationId = pendingDocs?.applicationId;
      if (!applicationId) {
        const res = await fetch("/api/proxy/doctors/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(doctorApplyPayload(form)),
        });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok) throw new Error(readApplyError(json, "Could not submit application"));
        const data = parseEnvelope<{ application_id?: string }>(json);
        applicationId = data.application_id;
        if (!applicationId) throw new Error("Application was accepted without an id.");
      }

      const docs = applyDocuments(form);
      const remainingTypes = pendingDocs?.remaining;
      const toUpload = remainingTypes
        ? docs.filter((d) => remainingTypes.includes(d.type))
        : docs;
      const failed = await uploadDocuments(applicationId, toUpload);
      if (failed.length > 0) {
        setPendingDocs({ applicationId, remaining: failed });
        throw new Error(
          `Application saved, but these documents failed to upload: ${failed.join(", ")}. Fix the files and submit again.`,
        );
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit application");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      scroll
      blurb="VersaLife Health for doctors. Apply to join the network — after approval you can sign in with email and password, or OTP."
    >
      <div className="flex w-full flex-col gap-6">
        <AuthHeading
          title="Doctor registration"
          subtitle={
            submitted
              ? undefined
              : "Tell us about your practice. Choose an email and password now — you will use them to sign in after approval."
          }
        />

        {submitted ? (
          <div className="flex w-full flex-col gap-6">
            <p className="text-body text-muted">
              Your application has been received and is under review. After approval you will get
              an email, then you can sign in with the email and password you chose here, or with
              OTP on your phone.
            </p>
            <AuthFooterLink text="Ready to continue?" linkText="Back to sign in" href="/login" />
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit} className="flex w-full flex-col gap-8">
              <Section title="Personal details">
                <Input
                  type="text"
                  required
                  minLength={1}
                  maxLength={100}
                  value={form.firstName}
                  onChange={(e) => patch({ firstName: e.target.value })}
                  placeholder="First name"
                  autoComplete="given-name"
                />
                <Input
                  type="text"
                  required
                  minLength={1}
                  maxLength={100}
                  value={form.lastName}
                  onChange={(e) => patch({ lastName: e.target.value })}
                  placeholder="Last name"
                  autoComplete="family-name"
                />
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => patch({ email: e.target.value })}
                  placeholder="Email"
                  autoComplete="email"
                />
                <Input
                  type="password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={form.password}
                  onChange={(e) => patch({ password: e.target.value })}
                  placeholder="Password (8–72 characters)"
                  autoComplete="new-password"
                />
                <Input
                  type="password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={form.confirmPassword}
                  onChange={(e) => patch({ confirmPassword: e.target.value })}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
                <Input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                  placeholder="+9477XXXXXXX"
                  autoComplete="tel"
                />
                <fieldset className="flex w-full flex-col gap-2">
                  <legend className="text-label text-ink">
                    What languages you consult in
                  </legend>
                  <div className="flex flex-wrap gap-4 px-1">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <label
                        key={lang.code}
                        className={radioClass}
                      >
                        <input
                          type="checkbox"
                          checked={form.languages.includes(lang.code)}
                          onChange={() => toggleLanguage(lang.code)}
                          className="size-4 accent-[var(--brand)]"
                        />
                        {lang.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {form.languages.includes("other") ? (
                  <Input
                    type="text"
                    required
                    maxLength={100}
                    value={form.languageOther}
                    onChange={(e) => patch({ languageOther: e.target.value })}
                    placeholder="Other language"
                  />
                ) : null}
                <label className="flex w-full flex-col gap-2">
                  <span className="text-label text-ink">
                    For specializations, are you PGIM board certified?
                  </span>
                  <YesNo
                    name="pgim"
                    value={form.pgimBoardCertified}
                    onChange={(v) => patch({ pgimBoardCertified: v })}
                  />
                </label>
                <Input
                  type="text"
                  required
                  maxLength={200}
                  value={form.medicalSchool}
                  onChange={(e) => patch({ medicalSchool: e.target.value })}
                  placeholder="Medical school"
                />
                <Textarea
                  required
                  maxLength={2000}
                  rows={3}
                  value={form.qualifications}
                  onChange={(e) => patch({ qualifications: e.target.value })}
                  placeholder="Qualifications"
                />
                <Input
                  type="number"
                  required
                  min={5}
                  max={240}
                  step={5}
                  value={form.consultationMinutes}
                  onChange={(e) => patch({ consultationMinutes: e.target.value })}
                  placeholder="How long each consultation takes (minutes)"
                />
                <Input
                  type="number"
                  required
                  min={0}
                  step={1}
                  value={form.feeLkr}
                  onChange={(e) => patch({ feeLkr: e.target.value })}
                  placeholder="How much you like to charge per consultation (LKR)"
                />
                <fieldset className="flex w-full flex-col gap-2">
                  <legend className="text-label text-ink">
                    Available times for consultation
                  </legend>
                  <div className="flex flex-wrap gap-3 px-1">
                    {WEEKDAYS.map((d) => (
                      <label
                        key={d.day}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-ink"
                      >
                        <input
                          type="checkbox"
                          checked={form.availableDays.includes(d.day)}
                          onChange={() => toggleDay(d.day)}
                          className="size-4 accent-[var(--brand)]"
                        />
                        {d.label.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-label text-ink">From</span>
                      <Input
                        type="time"
                        value={form.availableStart}
                        onChange={(e) => patch({ availableStart: e.target.value })}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-label text-ink">To</span>
                      <Input
                        type="time"
                        value={form.availableEnd}
                        onChange={(e) => patch({ availableEnd: e.target.value })}
                      />
                    </label>
                  </div>
                  <Textarea
                    rows={2}
                    maxLength={1000}
                    value={form.availabilityExtra}
                    onChange={(e) => patch({ availabilityExtra: e.target.value })}
                    placeholder="Any extra availability notes (optional)"
                  />
                </fieldset>
                <Input
                  type="text"
                  required
                  value={form.slmcNumber}
                  onChange={(e) => patch({ slmcNumber: e.target.value })}
                  placeholder="Board registration number (SLMC)"
                />
                <Input
                  type="number"
                  min={0}
                  max={70}
                  step={1}
                  value={form.experienceYears}
                  onChange={(e) => patch({ experienceYears: e.target.value })}
                  placeholder="Years of experience (optional)"
                />
              </Section>

              <Section title="Bank account details">
                <Input
                  type="text"
                  required
                  maxLength={100}
                  value={form.bankName}
                  onChange={(e) => patch({ bankName: e.target.value })}
                  placeholder="Bank name"
                  autoComplete="off"
                />
                <Input
                  type="text"
                  required
                  maxLength={100}
                  value={form.bankBranch}
                  onChange={(e) => patch({ bankBranch: e.target.value })}
                  placeholder="Bank branch"
                  autoComplete="off"
                />
                <Input
                  type="text"
                  required
                  maxLength={34}
                  value={form.accountNumber}
                  onChange={(e) => patch({ accountNumber: e.target.value })}
                  placeholder="Account number"
                  autoComplete="off"
                />
                <Input
                  type="text"
                  required
                  maxLength={200}
                  value={form.accountName}
                  onChange={(e) => patch({ accountName: e.target.value })}
                  placeholder="Account name"
                  autoComplete="off"
                />
              </Section>

              <Section title="Documents">
                {APPLY_DOCUMENT_TYPES.map((doc) => (
                  <label key={doc.type} className="flex w-full flex-col gap-2">
                    <span className="text-label text-ink">{doc.label}</span>
                    <input
                      className={fileClass}
                      type="file"
                      required={!pendingDocs}
                      accept={
                        doc.type === "slmc_certificate"
                          ? "image/*,application/pdf"
                          : "image/*"
                      }
                      onChange={(e) => setFile(doc.type, e.target.files?.[0] ?? null)}
                    />
                  </label>
                ))}
              </Section>

              <Section title="Practice">
                <Textarea
                  required
                  rows={3}
                  maxLength={2000}
                  value={form.practicingLocations}
                  onChange={(e) => patch({ practicingLocations: e.target.value })}
                  placeholder="Practicing locations / hospitals (one per line)"
                />
                <label className="flex w-full flex-col gap-2">
                  <span className="text-label text-ink">Are you a general practitioner?</span>
                  <YesNo
                    name="gp"
                    value={form.isGeneralPractitioner}
                    onChange={(v) => patch({ isGeneralPractitioner: v })}
                  />
                </label>
                <label className="flex w-full flex-col gap-2">
                  <span className="text-label text-ink">Specialty</span>
                  <select
                    className={selectClass}
                    required
                    value={form.specialty}
                    onChange={(e) => patch({ specialty: e.target.value })}
                  >
                    {SPECIALTIES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex w-full flex-col gap-2">
                  <span className="text-label text-ink">
                    Do you agree to the terms and conditions as stated in the VersaLife service
                    retention agreement?
                  </span>
                  <p className="text-body-sm text-muted">
                    <Link href={TERMS_HREF} className="font-semibold text-brand underline underline-offset-4" target="_blank">
                      Read the VersaLife service retention agreement
                    </Link>
                  </p>
                  <YesNo
                    name="terms"
                    value={form.termsAccepted}
                    onChange={(v) => patch({ termsAccepted: v })}
                    yesLabel="Accept"
                    noLabel="Don't accept"
                  />
                </label>
              </Section>

              {error ? <Alert tone="danger">{error}</Alert> : null}
              <Button type="submit" fullWidth busy={loading}>
                {loading
                  ? "Submitting…"
                  : pendingDocs
                    ? "Retry document upload"
                    : "Submit application"}
              </Button>
            </form>
            <AuthFooterLink text="Already approved?" linkText="Sign in" href="/login" />
          </>
        )}
      </div>
    </AuthLayout>
  );
}
