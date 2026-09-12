import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { DecisionPanel } from "@/components/admin/credentialing/decision-panel";
import { DocumentViewer } from "@/components/admin/credentialing/document-viewer";
import { VerificationStatusBadge } from "@/components/admin/credentialing/status-badge";
import { VerificationChecklistPanel } from "@/components/admin/credentialing/verification-checklist";
import { ScheduleEditor } from "@/components/admin/schedule/schedule-editor";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import {
  type DoctorDetailResponse,
  mapDoctorDetail,
} from "@/lib/admin/api/adapters/credentialing";
import {
  type DoctorApplicationResponse,
  mapApplicationDocuments,
} from "@/lib/admin/api/adapters/doctor-application";
import { ApplicationProfile } from "@/components/admin/credentialing/application-profile";
import { endpoints } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryGetServer } from "@/lib/admin/api/server";
import type { ScheduleSettings, WorkingHour } from "@/lib/admin/api/types";
import { formatDateTime, humanise } from "@/lib/admin/format";

const metadata: Metadata = { title: "Credential review" };

export default async function CredentialReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [detailResult, hoursResult, settingsResult, applicationResult] = await Promise.all([
    tryGetServer<DoctorDetailResponse>(endpoints.credentialing.detail(id)),
    tryGetServer<WorkingHour[]>(endpoints.doctorSchedule.availability(id)),
    tryGetServer<ScheduleSettings>(endpoints.doctorSchedule.settings(id)),
    tryGetServer<DoctorApplicationResponse>(endpoints.doctorSchedule.application(id)),
  ]);

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
      <Link href="/doctors">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the queue
      </Link>
    </Button>
  );

  if (!detailResult.ok) {
    const error = routeFatal(detailResult.error);
    return (
      <>
        {back}
        <PageHeader title="Credential review" />
        <ErrorState error={error} what="this doctor's registration" />
      </>
    );
  }

  const { doctor, checklist } = mapDoctorDetail(detailResult.data);
  const application = applicationResult.ok ? applicationResult.data : null;
  const applyDocuments = mapApplicationDocuments(application?.documents);

  return (
    <>
      {back}

      <PageHeader
        title={doctor.full_name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              SLMC <span className="font-mono">{doctor.slmc_number}</span>
            </span>
            {doctor.specialty_code ? <span>{humanise(doctor.specialty_code)}</span> : null}
            <span>Registered {formatDateTime(doctor.registered_at)}</span>
          </span>
        }
        actions={<VerificationStatusBadge status={doctor.verification_status} />}
      />

      <div className="grid min-h-0 gap-6 xl:grid-cols-2">
        <section aria-label="Submitted documents" className="min-w-0 space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Submitted documents
            </h2>
            <DocumentViewer
              documents={
                applyDocuments.length > 0
                  ? [
                      ...applyDocuments,
                      ...doctor.documents.filter((d) => d.kind !== "slmc_certificate"),
                    ]
                  : doctor.documents
              }
            />
          </div>
          {application ? <ApplicationProfile app={application} /> : null}
        </section>

        <section aria-label="Credential checks" className="min-w-0 space-y-6">
          <VerificationChecklistPanel doctor={doctor} checklist={checklist} />
          <DecisionPanel doctor={doctor} checklist={checklist} />
        </section>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Working hours</CardTitle>
          <CardDescription>
            The weekly pattern new appointment slots are generated from. Doctors
            usually phone or message their hours in rather than setting them
            themselves, so this is where staff enter them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hoursResult.ok ? (
            <ErrorState error={hoursResult.error} what="this doctor's schedule" />
          ) : !settingsResult.ok ? (
            <ErrorState error={settingsResult.error} what="this doctor's slot settings" />
          ) : (
            <ScheduleEditor
              doctorId={id}
              doctorName={doctor.full_name}
              initialHours={hoursResult.data}
              initialSettings={settingsResult.data}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
