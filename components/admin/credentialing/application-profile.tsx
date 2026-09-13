import { formatMoney, humanise } from "@/lib/admin/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import {
  languageLabel,
  type DoctorApplicationResponse,
} from "@/lib/admin/api/adapters/doctor-application";

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

export function ApplicationProfile({ app }: { app: DoctorApplicationResponse }) {
  const languages = (app.languages ?? [])
    .map((code) =>
      code === "other" && app.language_other
        ? `Other (${app.language_other})`
        : languageLabel(code),
    )
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-3">
          <Row label="First name" value={app.first_name ?? ""} />
          <Row label="Last name" value={app.last_name ?? ""} />
          <Row label="Email" value={app.email ?? ""} />
          <Row label="Phone" value={app.phone ?? ""} />
          <Row label="Languages" value={languages} />
          <Row label="PGIM board certified" value={yn(app.pgim_board_certified)} />
          <Row label="Medical school" value={app.medical_school ?? ""} />
          <Row label="Qualifications" value={app.qualifications ?? ""} />
          <Row label="Consultation fee" value={formatMoney(app.fee_cents, "LKR")} />
          <Row label="Availability / length" value={app.availability_notes ?? ""} />
          <Row label="Board registration (SLMC)" value={app.slmc_number ?? ""} />
          <Row label="Specialty" value={app.specialty ? humanise(app.specialty) : ""} />
          <Row label="General practitioner" value={yn(app.is_general_practitioner)} />
          <Row
            label="Practicing locations"
            value={(app.practicing_locations ?? []).join(", ")}
          />
          <Row label="Bank name" value={app.bank_name ?? ""} />
          <Row label="Bank branch" value={app.bank_branch ?? ""} />
          <Row
            label="Bank details submitted"
            value={yn(app.bank_details_submitted)}
          />
          <Row label="Terms accepted" value={yn(app.terms_accepted)} />
        </dl>
      </CardContent>
    </Card>
  );
}
