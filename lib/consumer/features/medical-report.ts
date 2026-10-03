import { browserApi } from "@/lib/consumer/api/client";
import { isNotFound } from "@/lib/consumer/api/errors";
import type { FitnessForWork, MedicalReport, SignedUrl } from "@/lib/consumer/api/types";
import { looksLikePdf, messageFromPdfDownloadFailure, stampPath } from "@/lib/consumer/features/prescription";
import { apiFileSrc } from "@/lib/consumer/features/practice";

export type ReportDraft = {
  addressee: string;
  clinicalImpression: string;
  findings: string;
  advice: string;
  fitness: FitnessForWork;
  leaveFrom: string;
  leaveUntil: string;
  returnToWorkOn: string;
  fitnessNotes: string;
};

export const DEFAULT_ADDRESSEE = "To whom it may concern";

export function blankReport(): ReportDraft {
  return {
    addressee: DEFAULT_ADDRESSEE,
    clinicalImpression: "",
    findings: "",
    advice: "",
    fitness: "notAssessed",
    leaveFrom: "",
    leaveUntil: "",
    returnToWorkOn: "",
    fitnessNotes: "",
  };
}

export function fromIssuedReport(report: MedicalReport): ReportDraft {
  return {
    addressee: report.addressee || DEFAULT_ADDRESSEE,
    clinicalImpression: report.clinicalImpression,
    findings: report.findings ?? "",
    advice: report.advice ?? "",
    fitness: report.fitness,
    leaveFrom: report.leaveFrom ?? "",
    leaveUntil: report.leaveUntil ?? "",
    returnToWorkOn: report.returnToWorkOn ?? "",
    fitnessNotes: report.fitnessNotes ?? "",
  };
}

export function needsLeaveDates(fitness: FitnessForWork): boolean {
  return fitness === "unfit" || fitness === "restricted";
}

export function issueReportError(draft: ReportDraft): string | null {
  if (!draft.clinicalImpression.trim()) {
    return "Add a clinical impression — a short statement of what you found.";
  }
  if (needsLeaveDates(draft.fitness) && (!draft.leaveFrom || !draft.leaveUntil)) {
    return "Leave start and end dates are required when the patient is unfit or restricted.";
  }
  if (draft.leaveFrom && draft.leaveUntil && draft.leaveUntil < draft.leaveFrom) {
    return "Leave cannot end before it starts.";
  }
  return null;
}

export function issueReportPayload(draft: ReportDraft): {
  addressee: string | null;
  clinicalImpression: string;
  findings: string | null;
  advice: string | null;
  fitness: FitnessForWork;
  leaveFrom: string | null;
  leaveUntil: string | null;
  returnToWorkOn: string | null;
  fitnessNotes: string | null;
} {
  const leave = needsLeaveDates(draft.fitness) || draft.leaveFrom || draft.leaveUntil;
  return {
    addressee: draft.addressee.trim() || DEFAULT_ADDRESSEE,
    clinicalImpression: draft.clinicalImpression.trim(),
    findings: draft.findings.trim() || null,
    advice: draft.advice.trim() || null,
    fitness: draft.fitness,
    leaveFrom: leave && draft.leaveFrom ? draft.leaveFrom : null,
    leaveUntil: leave && draft.leaveUntil ? draft.leaveUntil : null,
    returnToWorkOn: draft.returnToWorkOn.trim() || null,
    fitnessNotes: draft.fitnessNotes.trim() || null,
  };
}

export function medicalReportPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/medical-report`;
}

export function medicalReportPagePath(appointmentId: string): string {
  return `/appointments/${appointmentId}/medical-report`;
}

export function medicalReportByIdPagePath(id: string): string {
  return `/medical-reports/${id}`;
}

export function medicalReportPdfPath(id: string): string {
  return `/medical-reports/${id}/pdf`;
}

export async function loadStampSrc(kind: "signature" | "seal"): Promise<string | null> {
  try {
    const link = await browserApi<SignedUrl>(stampPath(kind));
    return apiFileSrc(link.url);
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

export async function downloadMedicalReportPdf(id: string): Promise<void> {
  const path = `/api/proxy${medicalReportPdfPath(id)}`;
  const send = () => fetch(path, { cache: "no-store" });
  let res = await send();
  if (res.status === 401) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
    if (refreshed.ok) res = await send();
  }
  const contentType = res.headers.get("content-type") || "";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (res.ok && looksLikePdf(bytes)) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `medical-report-${id}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }
  throw new Error(messageFromPdfDownloadFailure(res.status, contentType, new TextDecoder().decode(bytes)));
}
