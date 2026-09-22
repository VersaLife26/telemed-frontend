import type { Doctor, FormularyDrug, PrescriptionItem } from "@/lib/consumer/api/types";

export type ItemDraft = PrescriptionItem & { key: string };

export function blankItem(key = "item-1"): ItemDraft {
  return {
    key,
    drug_name: "",
    strength: "",
    form: "",
    dosage: "",
    frequency: "",
    duration_days: 7,
    quantity: 1,
    instructions: "",
    is_generic: false,
  };
}

export function fromIssued(items: PrescriptionItem[] | undefined): ItemDraft[] {
  if (!items?.length) return [blankItem()];
  return items.map((it, i) => ({ ...it, key: `issued-${i}` }));
}

export function completeLines(items: ItemDraft[]): ItemDraft[] {
  return items.filter((it) => it.drug_name.trim() && it.dosage.trim() && it.frequency.trim());
}

export function issueError(
  patientName: string,
  doctor: Doctor | null,
  items: ItemDraft[],
): string | null {
  if (!patientName.trim()) return "Patient name is required on the PDF.";
  if (!(doctor?.slmc_number || "").toUpperCase()) return "Your profile is missing an SLMC number.";
  if (!completeLines(items).length) {
    return "Add at least one drug with name, dosage, and frequency.";
  }
  return null;
}

export function fieldsFromDrug(drug: FormularyDrug): Partial<ItemDraft> {
  return {
    drug_name: drug.name,
    strength: drug.strength || "",
    form: drug.form || "",
    is_generic: Boolean(drug.is_generic),
  };
}

export function canSearchFormulary(query: string): boolean {
  return query.trim().length >= 2;
}

/**
 * Degree line plus a "University: ..." line for the prescription pad.
 * The profile bio is deliberately not used: it is free text ("Practicing
 * locations…") and was printing in the credentials block.
 */
export function doctorCredentialsText(doctor: Doctor | null): string {
  const quals = doctor?.qualifications || [];
  if (!quals.length) return "";
  const degrees = quals.map((q) => q.degree).filter(Boolean).join(", ");
  const universities = Array.from(new Set(quals.map((q) => q.institution).filter(Boolean))).join(", ");
  return [degrees, universities && `University: ${universities}`].filter(Boolean).join("\n");
}

export function issuePayload(opts: {
  appointmentId: string;
  doctor: Doctor | null;
  patientName: string;
  patientAge: string;
  items: ItemDraft[];
}) {
  const lines = completeLines(opts.items);
  return {
    appointment_id: opts.appointmentId,
    doctor_name: opts.doctor?.display_name || "Doctor",
    doctor_slmc: (opts.doctor?.slmc_number || "").toUpperCase(),
    doctor_qualifications: doctorCredentialsText(opts.doctor),
    clinic_name: "VersaLife Telemedicine",
    patient_name: opts.patientName.trim(),
    patient_age: Number.parseInt(opts.patientAge, 10) || 0,
    patient_nic: "",
    items: lines.map((it) => ({
      drug_name: it.drug_name.trim(),
      strength: it.strength || "",
      form: it.form || "",
      dosage: it.dosage.trim(),
      frequency: it.frequency.trim(),
      duration_days: Number(it.duration_days) || 1,
      quantity: Number(it.quantity) || 1,
      instructions: it.instructions || "",
      is_generic: Boolean(it.is_generic),
    })),
  };
}

export function lookupPath(appointmentId: string): string {
  return `/prescriptions?appointment_id=${encodeURIComponent(appointmentId)}`;
}

export function prescriptionPagePath(appointmentId: string): string {
  return `/appointments/${appointmentId}/prescription`;
}

export function prescriptionPdfPath(id: string): string {
  return `/prescriptions/${id}/pdf`;
}

/** PDF files always start with the five-byte header `%PDF-`. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

/**
 * Turns a non-PDF `/prescriptions/{id}/pdf` body into a doctor-facing error.
 * A stale VPS that still returns `{data:{pdf_url}}` has no `message` field,
 * which is why the UI used to show only the generic fallback.
 */
export function messageFromPdfDownloadFailure(status: number, contentType: string, bodyText: string): string {
  try {
    const json = JSON.parse(bodyText) as {
      message?: string;
      code?: string;
      error?: { message?: string };
      data?: { pdf_url?: string };
    };
    if (json.data?.pdf_url) {
      return "The prescription file is not being served yet. Please try Download again in a few minutes.";
    }
    const fromApi = json.message || json.error?.message;
    if (fromApi) return fromApi;
  } catch {
    /* not JSON */
  }
  const type = contentType || "unknown type";
  return `Could not download the prescription PDF. (${status} ${type})`;
}

/** Fetches the PDF through the BFF so cookies attach; a presigned /files URL 404s at the gateway. */
export async function downloadPrescriptionPdf(id: string): Promise<void> {
  const path = `/api/proxy${prescriptionPdfPath(id)}`;
  const send = () => fetch(path, { cache: "no-store" });
  let res = await send();
  if (res.status === 401) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
    if (refreshed.ok) res = await send();
  }
  const contentType = res.headers.get("content-type") || "";
  const bytes = new Uint8Array(await res.arrayBuffer());
  // Trust the file header, not Content-Type: a correct PDF with
  // application/octet-stream (or a charset suffix) must still download, and a
  // 200 JSON envelope must never be saved as ".pdf".
  if (res.ok && looksLikePdf(bytes)) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prescription-${id}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }
  throw new Error(messageFromPdfDownloadFailure(res.status, contentType, new TextDecoder().decode(bytes)));
}
