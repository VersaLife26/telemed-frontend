import { browserApi } from "@/lib/consumer/api/client";
import { isNotFound, problemMessage } from "@/lib/consumer/api/errors";
import type {
  FormularyDrug,
  PrescriptionItem,
  PrescriptionItemRequest,
  SignedUrl,
} from "@/lib/consumer/api/types";
import { apiFileSrc } from "@/lib/consumer/features/practice";

export type ItemDraft = {
  key: string;
  drugId: string | null;
  drugName: string;
  strength: string;
  form: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  instructions: string;
  isGeneric: boolean;
};

export function blankItem(key = "item-1"): ItemDraft {
  return {
    key,
    drugId: null,
    drugName: "",
    strength: "",
    form: "",
    dosage: "",
    frequency: "",
    durationDays: 7,
    quantity: 1,
    instructions: "",
    isGeneric: false,
  };
}

export function fromIssued(items: PrescriptionItem[] | undefined): ItemDraft[] {
  if (!items?.length) return [blankItem()];
  return [...items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((it, i) => ({
      key: `issued-${i}`,
      drugId: it.drugId,
      drugName: it.drugName,
      strength: it.strength,
      form: it.form,
      dosage: it.dosage,
      frequency: it.frequency,
      durationDays: it.durationDays,
      quantity: it.quantity,
      instructions: it.instructions ?? "",
      isGeneric: it.isGeneric,
    }));
}

export function completeLines(items: ItemDraft[]): ItemDraft[] {
  return items.filter((it) => it.drugName.trim() && it.dosage.trim() && it.frequency.trim());
}

export function issueError(items: ItemDraft[]): string | null {
  if (!completeLines(items).length) {
    return "Add at least one drug with name, dosage, and frequency.";
  }
  return null;
}

export function fieldsFromDrug(drug: FormularyDrug): Partial<ItemDraft> {
  return {
    drugId: drug.id,
    drugName: drug.name,
    strength: drug.strength || "",
    form: drug.form || "",
    isGeneric: drug.isGeneric,
  };
}

export function canSearchFormulary(query: string): boolean {
  return query.trim().length >= 2;
}

/** The server snapshots the prescriber and patient; only the drug lines are sent. */
export function issuePayload(items: ItemDraft[]): { items: PrescriptionItemRequest[] } {
  return {
    items: completeLines(items).map((it) => ({
      drugId: it.drugId,
      drugName: it.drugName.trim(),
      strength: it.strength.trim() || null,
      form: it.form.trim() || null,
      dosage: it.dosage.trim(),
      frequency: it.frequency.trim(),
      durationDays: Number(it.durationDays) || 1,
      quantity: Number(it.quantity) || 1,
      instructions: it.instructions.trim() || null,
      isGeneric: it.isGeneric,
    })),
  };
}

export type StampKind = "signature" | "seal";

export function stampPath(kind: StampKind): string {
  return `/doctors/me/${kind}`;
}

/** An image src for the doctor's uploaded signature or seal, or null when none is on file. */
export async function loadStampSrc(kind: StampKind): Promise<string | null> {
  try {
    const link = await browserApi<SignedUrl>(stampPath(kind));
    return apiFileSrc(link.url);
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

export function prescriptionPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/prescription`;
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

/** Turns a non-PDF `/prescriptions/{id}/pdf` body into a doctor-facing error. */
export function messageFromPdfDownloadFailure(status: number, contentType: string, bodyText: string): string {
  const fallback = `Could not download the prescription PDF. (${status} ${contentType || "unknown type"})`;
  try {
    return problemMessage(JSON.parse(bodyText), fallback);
  } catch {
    return fallback;
  }
}

/** Fetches the PDF through the BFF so cookies attach. */
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
  // JSON body must never be saved as ".pdf".
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
