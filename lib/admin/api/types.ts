/**
 * Wire types for the admin API surface.
 *
 * These mirror telemed-admin-service's schema (migrations 000002–000007) and
 * the `/api/v1/admin/*` routes the gateway proxies to it. Where a field is a
 * UUID that "means" a row in another service's database, it is typed as a
 * plain string: per ADR-004 there is no join to follow, and pretending
 * otherwise in the type system would be a lie the compiler enforces.
 *
 * Money is always integer cents with a separate currency, never a float —
 * AGENT-BRIEF §3.
 */

export type Uuid = string;
/** RFC 3339 timestamp, always UTC on the wire. */
export type Timestamp = string;
/** Integer minor units (cents). */
export type Cents = number;

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** Mirrors `middleware.AdminRoles` in the Go platform package. */
export const ADMIN_ROLES = ["super_admin", "admin", "ops", "finance", "support"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Credentialing — doctor_projection + verification_checklists
// ---------------------------------------------------------------------------

export type VerificationStatus = "pending" | "approved" | "rejected";

export interface PendingDoctor {
  doctor_id: Uuid;
  full_name: string;
  email: string | null;
  phone: string | null;
  slmc_number: string;
  years_experience: number | null;
  specialty_code: string | null;
  verification_status: VerificationStatus;
  registered_at: Timestamp;
  /**
   * Presigned URLs, minted by admin-service from the MinIO object keys held
   * in doctor_projection. Short-lived by design; the detail screen refetches
   * rather than caching them.
   */
  documents: CredentialDocument[];
}

export type CredentialDocumentKind =
  | "slmc_certificate"
  | "nic_document"
  | "degree_certificate"
  | "photo"
  | "signature"
  | "seal";

export interface CredentialDocument {
  kind: CredentialDocumentKind;
  /** Presigned GET URL. Expires — see `expires_at`. */
  url: string;
  content_type: string;
  expires_at: Timestamp;
}

/** The five checks migration 000003 stores, each with its own provenance. */
export type ChecklistItemKey =
  | "slmc_format_valid"
  | "slmc_registry_checked"
  | "experience_verified"
  | "nic_matches"
  | "photo_clear";

export interface ChecklistItemState {
  value: boolean | null;
  checked_by: Uuid | null;
  checked_at: Timestamp | null;
}

export interface VerificationChecklist {
  id: Uuid;
  doctor_id: Uuid;
  items: Record<ChecklistItemKey, ChecklistItemState>;
  overall_status: VerificationStatus;
  decision_reason: string | null;
  decided_by: Uuid | null;
  decided_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  version: number;
}

export interface ChecklistPatchRequest {
  item: ChecklistItemKey;
  value: boolean;
  /** Optimistic lock — migration 000003 gives every row a `version`. */
  version: number;
}

export interface VerifyDecisionRequest {
  action: "approve" | "reject";
  /** Mandatory in both directions. An approval with no note is not evidence. */
  reason: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Users — user_projection
// ---------------------------------------------------------------------------

export type UserStatus = "active" | "suspended";
export type UserRole = "patient" | "doctor";

export interface AdminUserRecord {
  user_id: Uuid;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  registered_at: Timestamp | null;
  updated_at: Timestamp;
}

export interface SuspendUserRequest {
  reason: string;
}

/**
 * A user's recent activity, assembled by admin-service from its own audit log
 * and appointment projection. Deliberately carries no clinical content: no
 * symptoms, no diagnosis, no prescription. The backend's RLS blocks it and
 * this console does not ask for it.
 */
export interface UserActivityEntry {
  occurred_at: Timestamp;
  kind: string;
  summary: string;
  reference_id: Uuid | null;
}

// ---------------------------------------------------------------------------
// Appointments — appointments_projection
// ---------------------------------------------------------------------------

export type AppointmentStatus =
  | "created"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export interface AdminAppointment {
  appointment_id: Uuid;
  doctor_id: Uuid | null;
  doctor_name: string | null;
  patient_id: Uuid | null;
  patient_reference: string | null;
  specialty_code: string | null;
  district: string | null;
  status: AppointmentStatus;
  scheduled_at: Timestamp | null;
  occurred_at: Timestamp;
}

export interface ForceCancelRequest {
  reason: string;
  refund: boolean;
}

/** Two appointments landed on one slot; the admin picks which one survives. */
export interface DoubleBooking {
  slot_id: Uuid;
  doctor_id: Uuid;
  doctor_name: string | null;
  scheduled_at: Timestamp;
  appointments: AdminAppointment[];
}

export interface ResolveDoubleBookingRequest {
  slot_id: Uuid;
  /** The appointment that keeps the slot. Every other one is cancelled. */
  keep_appointment_id: Uuid;
  reason: string;
}

export type RescheduleRequestStatus = "pending" | "accepted" | "declined" | "expired";

export interface AdminRescheduleRequest {
  id: Uuid;
  appointment_id: Uuid;
  patient_id: Uuid;
  doctor_id: Uuid;
  original_start_at: Timestamp;
  original_end_at: Timestamp;
  original_start_at_local?: string;
  proposed_start_at: Timestamp;
  proposed_end_at: Timestamp;
  proposed_start_at_local?: string;
  reason?: string;
  status: RescheduleRequestStatus | string;
  created_at: Timestamp;
}

// ---------------------------------------------------------------------------
// Finance — payments_projection, refunds, payouts, commission rules
// ---------------------------------------------------------------------------

export type PaymentStatus = "succeeded" | "failed" | "refunded";
export type PaymentProvider = "stripe" | "payhere" | "dialog";

export interface LedgerEntry {
  payment_id: Uuid;
  appointment_id: Uuid | null;
  doctor_id: Uuid | null;
  specialty_code: string | null;
  district: string | null;
  amount_cents: Cents;
  commission_cents: Cents;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProvider | null;
  occurred_at: Timestamp;
}

export interface RefundRequestRecord {
  id: Uuid;
  payment_id: Uuid;
  appointment_id: Uuid | null;
  dispute_id: Uuid | null;
  amount_cents: Cents;
  currency: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_at: Timestamp;
  decided_at: Timestamp | null;
  decided_by: Uuid | null;
}

export interface PayoutBatch {
  id: Uuid;
  status: "pending" | "processing" | "paid" | "failed";
  doctor_count: number;
  total_cents: Cents;
  currency: string;
  created_at: Timestamp;
  completed_at: Timestamp | null;
}

/**
 * A commission rule. The V2 docs give the shape literally as
 * `{specialty: "GP", commission: 20}`; we keep that and add the optional
 * bounds finance asked for so a percentage cannot silently produce a
 * three-rupee payout on a large consult.
 */
export interface CommissionRule {
  specialty: string;
  commission_percent: number;
  min_commission_cents?: number;
  max_commission_cents?: number;
}

export interface CommissionRuleSet {
  default_commission_percent: number;
  rules: CommissionRule[];
}

// ---------------------------------------------------------------------------
// Content — specialties, symptoms, drugs, articles
// ---------------------------------------------------------------------------

export type ContentLanguage = "en" | "si" | "ta";

export interface Specialty {
  id: Uuid;
  code: string;
  name_en: string;
  name_si: string | null;
  name_ta: string | null;
  active: boolean;
  updated_at: Timestamp;
  version: number;
}

export interface Symptom {
  id: Uuid;
  code: string;
  name_en: string;
  name_si: string | null;
  name_ta: string | null;
  specialty_codes: string[];
  active: boolean;
  updated_at: Timestamp;
  version: number;
}

export interface Drug {
  id: Uuid;
  name: string;
  strength: string | null;
  form: string | null;
  manufacturer: string | null;
  active: boolean;
  updated_at: Timestamp;
  version: number;
}

export interface Article {
  id: Uuid;
  title: string;
  slug: string;
  language: ContentLanguage;
  specialty_code: string | null;
  published: boolean;
  published_at: Timestamp | null;
  updated_at: Timestamp;
  version: number;
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

export type DisputeCategory =
  | "billing"
  | "quality_of_care"
  | "no_show"
  | "technical"
  | "other";
export type DisputeStatus = "open" | "investigating" | "resolved" | "closed";

export interface Dispute {
  id: Uuid;
  appointment_id: Uuid;
  patient_id: Uuid;
  doctor_id: Uuid;
  doctor_name: string | null;
  category: DisputeCategory;
  description: string;
  status: DisputeStatus;
  assigned_to: Uuid | null;
  assigned_to_name: string | null;
  resolution: string | null;
  refund_requested: boolean;
  refund_amount_cents: Cents | null;
  currency: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  version: number;
}

export interface DisputeComment {
  id: Uuid;
  dispute_id: Uuid;
  author_admin_id: Uuid;
  author_name: string | null;
  body: string;
  created_at: Timestamp;
}

export interface AssignDisputeRequest {
  assigned_to: Uuid | null;
  version: number;
}

export interface ResolveDisputeRequest {
  status: Extract<DisputeStatus, "resolved" | "closed">;
  resolution: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Settings — system_configs (append-only, versioned)
// ---------------------------------------------------------------------------

export interface SystemConfig<T = unknown> {
  key: string;
  value: T;
  version: number;
  updated_by: Uuid | null;
  effective_from: Timestamp;
  created_at: Timestamp;
}

export interface SlotDefaults {
  slot_duration_minutes: number;
  buffer_minutes: number;
  horizon_days: number;
  max_per_day: number;
}

export interface CancellationPolicy {
  free_cancellation_hours: number;
  late_cancellation_fee_percent: number;
  no_show_fee_percent: number;
}

export interface FeeCaps {
  currency: string;
  min_fee_cents: Cents;
  max_fee_cents: Cents;
  per_specialty_max_cents: Record<string, Cents>;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
}

export interface CorporateClient {
  id: Uuid;
  name: string;
  contact_email: string | null;
  active: boolean;
  covered_employee_count: number;
  discount_percent: number;
}

/** The `key` values this console knows how to render. */
export const CONFIG_KEYS = {
  slotDefaults: "slot_defaults",
  cancellationPolicy: "cancellation_policy",
  feeCaps: "fee_caps",
  featureFlags: "feature_flags",
  corporateClients: "corporate_clients",
  commissionRules: "commission_rules",
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];

// ---------------------------------------------------------------------------
// Analytics — the four materialized views in migration 000004
// ---------------------------------------------------------------------------

export interface RevenuePoint {
  day: Timestamp;
  currency: string;
  gross_cents: Cents;
  commission_cents: Cents;
  payment_count: number;
}

export interface BookingsPoint {
  day: Timestamp;
  specialty_code: string;
  status: AppointmentStatus;
  booking_count: number;
}

export interface DoctorUtilisationRow {
  doctor_id: Uuid;
  doctor_name: string | null;
  completed_count: number;
  no_show_count: number;
  cancelled_count: number;
  total_count: number;
}

export interface DistrictActivityRow {
  district: string;
  booking_count: number;
}

export interface SpecialtyShareRow {
  specialty_code: string;
  booking_count: number;
}

export interface DashboardSummary {
  range_from: Timestamp;
  range_to: Timestamp;
  currency: string;
  gross_cents: Cents;
  commission_cents: Cents;
  bookings: number;
  active_users: number;
  completed_consultations: number;
  no_show_rate: number;
  revenue: RevenuePoint[];
  bookings_daily: BookingsPoint[];
  top_specialties: SpecialtyShareRow[];
  doctor_utilisation: DoctorUtilisationRow[];
  districts: DistrictActivityRow[];
}

// ---------------------------------------------------------------------------
// Audit — audit_logs + the hash chain
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: number;
  actor_id?: Uuid;
  actor_role: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_value?: unknown;
  new_value?: unknown;
  ip?: string;
  user_agent?: string;
  request_id?: string;
  created_at: Timestamp;
  prev_hash: string;
  row_hash: string;
}

/** Response of POST /api/v1/admin/audit/verify — matches audit.VerifyResult. */
export interface ChainVerifyResult {
  valid: boolean;
  checked: number;
  from_id: number;
  last_id?: number;
  next_from_id?: number;
  broken?: {
    id: number;
    reason: string;
  };
}

// ---------------------------------------------------------------------------
// Session identity
// ---------------------------------------------------------------------------

/**
 * What GET /api/v1/admin/me returns: the admin_users row for the identity in
 * the bearer token.
 *
 * `keycloak_subject` keeps its name because the database column does. Since
 * Cloudflare Access replaced Keycloak it holds the normalised email address,
 * which is what the backend's Directory matches an Access token on; renaming
 * the column is a migration on a live table for no behavioural gain.
 */
export interface AdminIdentity {
  id: Uuid;
  keycloak_subject: string;
  email: string;
  display_name: string;
  role: AdminRole;
  active: boolean;
  last_login_at: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Admin accounts — admin_users
// ---------------------------------------------------------------------------

/**
 * The five roles a super_admin may assign, ordered least-privilege first so
 * the picker does not read as though super_admin were the natural choice.
 * Mirrors rbac.AssignableRoles in admin-service, which is itself pinned to the
 * admin_users.role CHECK constraint by a test.
 */
export const ASSIGNABLE_ADMIN_ROLES = [
  "support",
  "ops",
  "finance",
  "admin",
  "super_admin",
] as const;

export type AssignableAdminRole = (typeof ASSIGNABLE_ADMIN_ROLES)[number];

/** One admin_users row: a colleague's console account. */
export interface AdminAccount {
  id: Uuid;
  email: string;
  display_name: string;
  role: AssignableAdminRole;
  ip_allowlist: string[];
  active: boolean;
  last_login_at?: Timestamp | null;
  version: number;
}

/**
 * One row of the permission grid, served by admin-service from the RBAC matrix
 * it actually enforces rather than from a second copy maintained here.
 */
export interface PermissionGroup {
  group: string;
  label: string;
  detail: string;
  roles: AssignableAdminRole[];
}

export interface PermissionMatrix {
  groups: PermissionGroup[];
  roles: AssignableAdminRole[];
}

export interface CreateAdminRequest {
  email: string;
  display_name: string;
  role: AssignableAdminRole;
  ip_allowlist?: string[];
}

export interface UpdateAdminRequest {
  active?: boolean;
  role?: AssignableAdminRole;
  ip_allowlist?: string[];
  version: number;
}

// ---------------------------------------------------------------------------
// Doctor schedules — staff-operated
// ---------------------------------------------------------------------------

/** One weekly working block. day_of_week is 0 = Sunday. */
export interface WorkingHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

/**
 * Slot shape. buffer_minutes is nullable on purpose: 0 means back-to-back
 * consultations, which is a real preference, and null means never set.
 * Collapsing the two hands the doctor the default gap forever.
 */
export interface ScheduleSettings {
  slot_duration_minutes: number;
  buffer_minutes: number | null;
  max_per_day: number;
  timezone?: string;
}

export interface SetAvailabilityRequest {
  working_hours: WorkingHour[];
  slot_duration_minutes: number;
  buffer_minutes: number | null;
  max_per_day: number;
}

// ---------------------------------------------------------------------------
// Admin in-app notifications
// ---------------------------------------------------------------------------

/** Projected kinds written by admin-service's notifications projector. */
export type AdminNotificationKind = "doctor_application" | "reschedule_request";

export interface AdminNotification {
  id: Uuid;
  kind: AdminNotificationKind | string;
  title: string;
  body: string;
  href: string;
  created_at: Timestamp;
  resource_id?: Uuid;
}

export interface AdminNotificationList {
  items: AdminNotification[];
}

export interface AdminNotificationUnreadCount {
  count: number;
}
