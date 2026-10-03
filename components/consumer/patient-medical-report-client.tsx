"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { FormSkeleton } from "@/components/consumer/ui/skeletons";
import { browserApi } from "@/lib/consumer/api/client";
import { ApiError } from "@/lib/consumer/api/errors";
import type { MedicalReport } from "@/lib/consumer/api/types";
import {
  downloadMedicalReportPdf,
  medicalReportByIdPagePath,
} from "@/lib/consumer/features/medical-report";

export function PatientMedicalReportClient({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [report, setReport] = useState<MedicalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await browserApi<MedicalReport>(`/medical-reports/${reportId}`);
        if (!cancelled) setReport(data);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(medicalReportByIdPagePath(reportId))}`);
          return;
        }
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load your medical report.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId, router]);

  async function download() {
    setError(null);
    setDownloading(true);
    try {
      await downloadMedicalReportPdf(reportId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the medical report PDF.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <FormSkeleton />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-8">
      <h1 className="text-h2 text-ink">Your medical report</h1>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {report ? (
        <Card variant="tint" className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
            <div>
              <p className="font-medium text-ink">Dr. {report.doctorName}</p>
              <p className="text-sm text-muted">
                Issued {new Date(report.issuedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <p className="mt-2 text-body-sm text-ink">{report.clinicalImpression}</p>
            </div>
          </div>
          <Button type="button" onClick={() => void download()} disabled={downloading} className="w-full">
            <Download className="size-4" aria-hidden />
            {downloading ? "Downloading…" : "Download PDF"}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
