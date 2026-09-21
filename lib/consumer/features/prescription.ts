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
    doctor_qualifications: opts.doctor?.bio || "",
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

/** Fetches the PDF through the BFF so cookies attach; a presigned /files URL 404s at the gateway. */
export async function downloadPrescriptionPdf(id: string): Promise<void> {
  const path = `/api/proxy${prescriptionPdfPath(id)}`;
  const send = () => fetch(path, { cache: "no-store" });
  let res = await send();
  if (res.status === 401) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
    if (refreshed.ok) res = await send();
  }
  if (!res.ok) {
    let message = "Could not download the prescription PDF.";
    try {
      const json = (await res.json()) as { message?: string; error?: { message?: string } };
      message = json.message || json.error?.message || message;
    } catch {
      /* keep the default */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `prescription-${id}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
