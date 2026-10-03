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
import type { Prescription } from "@/lib/consumer/api/types";
import { downloadPrescriptionPdf, prescriptionByIdPagePath } from "@/lib/consumer/features/prescription";

export function PatientPrescriptionClient({ prescriptionId }: { prescriptionId: string }) {
  const router = useRouter();
  const [rx, setRx] = useState<Prescription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await browserApi<Prescription>(`/prescriptions/${prescriptionId}`);
        if (!cancelled) setRx(p);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(prescriptionByIdPagePath(prescriptionId))}`);
          return;
        }
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load your prescription.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prescriptionId, router]);

  async function download() {
    setError(null);
    setDownloading(true);
    try {
      await downloadPrescriptionPdf(prescriptionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the prescription PDF.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <FormSkeleton />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-8">
      <h1 className="text-h2 text-ink">Your prescription</h1>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {rx ? (
        <Card variant="tint" className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
            <div>
              <p className="font-medium text-ink">Dr. {rx.doctorName}</p>
              <p className="text-sm text-muted">
                Issued {new Date(rx.issuedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
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
