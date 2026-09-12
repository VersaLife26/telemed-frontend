import type { CredentialDocument, CredentialDocumentKind } from "@/lib/admin/api/types";

/** Wire shape of GET /api/v1/admin/doctors/{id}/application?include=bytes */
export interface DoctorApplicationResponse {
  application_id: string;
  phone?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  slmc_number?: string;
  specialty?: string;
  languages?: string[];
  language_other?: string;
  experience_years?: number;
  fee_cents?: number;
  required_fee_cents?: number;
  bio?: string;
  pgim_board_certified?: boolean;
  medical_school?: string;
  qualifications?: string;
  availability_notes?: string;
  is_general_practitioner?: boolean;
  practicing_locations?: string[];
  bank_name?: string;
  bank_branch?: string;
  bank_details_submitted?: boolean;
  terms_accepted?: boolean;
  status?: string;
  documents?: DoctorApplicationDocument[];
}

export interface DoctorApplicationDocument {
  document_type: string;
  filename?: string;
  content_type?: string;
  uploaded_at?: string;
  data_base64?: string;
}

const APPLY_KINDS = new Set<CredentialDocumentKind>([
  "signature",
  "seal",
  "slmc_certificate",
]);

export function mapApplicationDocuments(
  documents: DoctorApplicationDocument[] | undefined,
): CredentialDocument[] {
  if (!documents?.length) return [];
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const out: CredentialDocument[] = [];
  for (const doc of documents) {
    if (!APPLY_KINDS.has(doc.document_type as CredentialDocumentKind)) continue;
    if (!doc.data_base64) continue;
    const contentType = doc.content_type || "application/octet-stream";
    out.push({
      kind: doc.document_type as CredentialDocumentKind,
      url: `data:${contentType};base64,${doc.data_base64}`,
      content_type: contentType,
      expires_at: expiresAt,
    });
  }
  return out;
}

export function languageLabel(code: string): string {
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
