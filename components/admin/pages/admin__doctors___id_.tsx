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
import { ApplicationProfile } from "@/components/admin/credentialing/application-profile";
import { endpoints } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryGetServer } from "@/lib/admin/api/server";
import type { DoctorApplication, Schedule } from "@/lib/admin/api/types";
import { formatDateTime, humanise } from "@/lib/admin/format";

const metadata: Metadata = { title: "Credential review" };

export default async function CredentialReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detailResult = await tryGetServer<DoctorApplication>(endpoints.credentialing.detail(id));
  const doctorId = detailResult.ok ? detailResult.data.doctorId : null;
  const scheduleResult = doctorId
    ? await tryGetServer<Schedule>(endpoints.doctorSchedule.schedule(doctorId))
    : null;

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

  const application = detailResult.data;

  return (
    <>
      {back}

      <PageHeader
        title={application.displayName ?? "Doctor application"}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              SLMC <span className="font-mono">{application.slmcNumber}</span>
            </span>
            {application.specialtyCode ? <span>{humanise(application.specialtyCode)}</span> : null}
            <span>Applied {formatDateTime(application.createdAt)}</span>
          </span>
        }
        actions={application.status ? <VerificationStatusBadge status={application.status} /> : null}
      />

      <div className="grid min-h-0 gap-6 xl:grid-cols-2">
        <section aria-label="Submitted documents" className="min-w-0 space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Submitted documents
            </h2>
            <DocumentViewer applicationId={id} documents={application.documents ?? []} />
          </div>
          <ApplicationProfile app={application} />
        </section>

        <section aria-label="Credential checks" className="min-w-0 space-y-6">
          <VerificationChecklistPanel application={application} />
          <DecisionPanel application={application} />
        </section>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Working hours</CardTitle>
          <CardDescription>
            The weekly pattern bookable times are generated from. Doctors
            usually phone or message their hours in rather than setting them
            themselves, so this is where staff enter them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!doctorId || !scheduleResult ? (
            <p className="text-sm text-muted-foreground">
              Working hours can be set once this application is approved.
            </p>
          ) : !scheduleResult.ok ? (
            <ErrorState error={routeFatal(scheduleResult.error)} what="this doctor's schedule" />
          ) : (
            <ScheduleEditor
              doctorId={doctorId}
              doctorName={application.displayName ?? "this doctor"}
              initialSchedule={scheduleResult.data}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
