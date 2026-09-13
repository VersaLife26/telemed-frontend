import type {
  ChecklistItemKey,
  CredentialDocument,
  CredentialDocumentKind,
  PendingDoctor,
  VerificationChecklist,
  VerificationStatus,
} from "@/lib/admin/api/types";

/** Wire shape of GET /api/v1/admin/doctors/{id}. */
export interface DoctorDetailResponse {
  doctor: {
    doctor_id: string;
    full_name: string;
    email?: string;
    phone?: string;
    slmc_number: string;
    years_experience?: number;
    specialty_code?: string;
    verification_status: VerificationStatus;
    registered_at: string;
    slmc_certificate_url?: string;
    nic_document_url?: string;
    degree_certificate_url?: string;
    photo_url?: string;
    documents_expire_at?: string;
  };
  checklist: BackendChecklistDTO;
}

interface BackendChecklistDTO {
  id?: string;
  doctor_id: string;
  slmc_format_valid?: boolean | null;
  slmc_registry_checked?: boolean | null;
  experience_verified?: boolean | null;
  nic_matches?: boolean | null;
  photo_clear?: boolean | null;
  overall_status?: VerificationStatus | string;
  decision_reason?: string | null;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

const DOC_FIELDS: ReadonlyArray<{
  kind: CredentialDocumentKind;
  urlKey: keyof DoctorDetailResponse["doctor"];
}> = [
  { kind: "slmc_certificate", urlKey: "slmc_certificate_url" },
  { kind: "nic_document", urlKey: "nic_document_url" },
  { kind: "degree_certificate", urlKey: "degree_certificate_url" },
  { kind: "photo", urlKey: "photo_url" },
];

function buildDocuments(
  doctor: DoctorDetailResponse["doctor"],
): CredentialDocument[] {
  const expiresAt =
    doctor.documents_expire_at ??
    new Date(Date.now() + 3_600_000).toISOString();

  const documents: CredentialDocument[] = [];
  for (const { kind, urlKey } of DOC_FIELDS) {
    const url = doctor[urlKey];
    if (typeof url === "string" && url.length > 0) {
      documents.push({
        kind,
        url,
        content_type: kind === "photo" ? "image/jpeg" : "application/pdf",
        expires_at: expiresAt,
      });
    }
  }
  return documents;
}

function itemState(value: boolean | null | undefined) {
  return {
    value: value ?? null,
    checked_by: null,
    checked_at: null,
  };
}

export function mapChecklistDTO(raw: BackendChecklistDTO): VerificationChecklist {
  const rawStatus = String(raw.overall_status ?? "pending");
  const status: VerificationStatus =
    rawStatus === "not_started" || rawStatus === "pending"
      ? "pending"
      : (rawStatus as VerificationStatus);

  const items: Record<ChecklistItemKey, ReturnType<typeof itemState>> = {
    slmc_format_valid: itemState(raw.slmc_format_valid),
    slmc_registry_checked: itemState(raw.slmc_registry_checked),
    experience_verified: itemState(raw.experience_verified),
    nic_matches: itemState(raw.nic_matches),
    photo_clear: itemState(raw.photo_clear),
  };

  return {
    id: raw.id ?? raw.doctor_id,
    doctor_id: raw.doctor_id,
    items,
    overall_status: status,
    decision_reason: raw.decision_reason ?? null,
    decided_by: null,
    decided_at: null,
    created_at: raw.created_at ?? new Date(0).toISOString(),
    updated_at: raw.updated_at ?? new Date(0).toISOString(),
    version: raw.version ?? 0,
  };
}

export function mapDoctorDetail(data: DoctorDetailResponse): {
  doctor: PendingDoctor;
  checklist: VerificationChecklist;
} {
  const doctor = data.doctor;
  return {
    doctor: {
      doctor_id: doctor.doctor_id,
      full_name: doctor.full_name,
      email: doctor.email ?? null,
      phone: doctor.phone ?? null,
      slmc_number: doctor.slmc_number,
      years_experience: doctor.years_experience ?? null,
      specialty_code: doctor.specialty_code ?? null,
      verification_status: doctor.verification_status,
      registered_at: doctor.registered_at,
      documents: buildDocuments(doctor),
    },
    checklist: mapChecklistDTO(data.checklist),
  };
}

/** Maps a checklist item key to the PUT body field admin-service expects. */
export function checklistFieldBody(
  item: ChecklistItemKey,
  value: boolean,
): Record<string, boolean> {
  return { [item]: value };
}

/**
 * Body for POST /api/v1/admin/doctors/{id}/verify.
 *
 * Do not send `version`. admin-service DecodeJSON uses DisallowUnknownFields,
 * and verifyRequest does not (historically) declare that field — the 400
 * landed as a toast behind the confirmation dialog, which looks like a dead
 * Confirm button.
 */
export function verifyDecisionBody(
  action: "approve" | "reject",
  reason: string,
): { action: "approve" | "reject"; reason: string } {
  return { action, reason: reason.trim() };
}
