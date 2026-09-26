import { formatMoney, humanise } from "@/lib/admin/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import type { DoctorApplication } from "@/lib/admin/api/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground sm:col-span-2">{value || "—"}</dd>
    </div>
  );
}

function yn(value: boolean | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

function languageLabel(code: string): string {
  switch (code) {
    case "en":
      return "English";
    case "si":
      return "Sinhala";
    case "ta":
      return "Tamil";
    case "other":
      return "Other";
    default:
      return code;
  }
}

export function ApplicationProfile({ app }: { app: DoctorApplication }) {
  const languages = (app.languages ?? [])
    .map((code) =>
      code === "other" && app.languageOther ? `Other (${app.languageOther})` : languageLabel(code),
    )
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-3">
          <Row label="First name" value={app.firstName ?? ""} />
          <Row label="Last name" value={app.lastName ?? ""} />
          <Row label="Email" value={app.email ?? ""} />
          <Row label="Phone" value={app.phone ?? ""} />
          <Row label="Languages" value={languages} />
          <Row label="PGIM board certified" value={yn(app.pgimBoardCertified)} />
          <Row label="Medical school" value={app.medicalSchool ?? ""} />
          <Row label="Qualifications" value={app.qualificationsText ?? ""} />
          <Row
            label="Experience"
            value={app.experienceYears === undefined ? "" : `${app.experienceYears} years`}
          />
          <Row label="Consultation fee" value={formatMoney(app.feeCents, "LKR")} />
          <Row label="Availability / length" value={app.availabilityNotes ?? ""} />
          <Row label="Board registration (SLMC)" value={app.slmcNumber ?? ""} />
          <Row label="Specialty" value={app.specialtyCode ? humanise(app.specialtyCode) : ""} />
          <Row label="General practitioner" value={yn(app.isGeneralPractitioner)} />
          <Row label="Practicing locations" value={(app.practicingLocations ?? []).join(", ")} />
          <Row label="Bank name" value={app.bankName ?? ""} />
          <Row label="Bank branch" value={app.bankBranch ?? ""} />
          <Row label="Terms accepted" value={yn(app.termsAcceptedAt ? true : undefined)} />
        </dl>
      </CardContent>
    </Card>
  );
}
