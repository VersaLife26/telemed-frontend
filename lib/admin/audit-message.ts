import type { AuditEntry } from "@/lib/admin/api/types";
import { humanise } from "@/lib/admin/format";

const SUBJECTS: Record<string, string> = {
  appointments: "Appointment",
  payments: "Payment",
  refunds: "Refund",
  reschedule_requests: "Reschedule request",
  users: "Profile",
  doctors: "Doctor profile",
  doctor_applications: "Doctor application",
  doctor_documents: "Doctor document",
  working_hours: "Availability",
  slot_blocks: "Blocked time",
  holidays: "Holiday",
  consultations: "Consultation",
  clinical_notes: "Clinical note",
  prescriptions: "Prescription",
  vault_documents: "Vault file",
  vault_folders: "Vault folder",
  payouts: "Payout",
  payout_batches: "Payout batch",
  disputes: "Customer care",
  promo_codes: "Promo code",
  promo_redemptions: "Promo redemption",
  sessions: "Session",
};

const STATUS_PHRASES: Record<string, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  completed: "Completed",
  no_show: "Marked no-show",
  cancelled: "Cancelled",
  pending: "Pending",
  authorized: "Authorized",
  succeeded: "Succeeded",
  failed: "Failed",
  voided: "Voided",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  active: "Activated",
  suspended: "Suspended",
  deleted: "Deleted",
};

/**
 * One sentence an admin can read without guessing what "Created" referred to.
 */
export function describeAuditActivity(entry: Pick<AuditEntry, "action" | "entityType" | "changes">): string {
  const action = entry.action.trim().toLowerCase();
  const entity = entry.entityType.trim().toLowerCase();
  const status = changedField(entry.changes, "status");

  if (action === "logged_in" || (entity === "sessions" && action === "logged_in")) return "Logged in";
  if (action === "logged_out" || (entity === "sessions" && action === "logged_out")) return "Logged out";

  if (entity === "users") {
    if (action === "created") return "Account created";
    if (action === "deleted") return "Account deleted";
    if (status === "suspended") return "Account suspended";
    if (status === "active") return "Account reinstated";
    if (status === "deleted") return "Account deleted";
    return "Updated profile";
  }

  if (entity === "doctors") {
    if (action === "created") return "Doctor profile created";
    if (status) return `Doctor profile ${humanise(status).toLowerCase()}`;
    return action === "deleted" ? "Doctor profile deleted" : "Updated doctor profile";
  }

  const subject = SUBJECTS[entity] ?? humanise(entity.replace(/_/g, " ").replace(/s$/, "") || entity);

  if (action === "created") return `${subject} created`;
  if (action === "deleted") return `${subject} deleted`;

  if (status) {
    const phrase = STATUS_PHRASES[status] ?? humanise(status);
    if (entity === "appointments") return `Appointment ${phrase.toLowerCase()}`;
    if (entity === "payments") return `Payment ${phrase.toLowerCase()}`;
    return `${subject} ${phrase.toLowerCase()}`;
  }

  return `${subject} ${humanise(action).toLowerCase()}`;
}

export function describeAuditActor(
  entry: Pick<AuditEntry, "actorType" | "actorId" | "actorEmail">,
  subject?: { id: string; role?: string } | null,
): string {
  if (entry.actorType === "admin") {
    return entry.actorEmail ? `Admin · ${entry.actorEmail}` : "Admin";
  }
  if (entry.actorType === "system") return "System";
  if (subject && entry.actorId === subject.id) {
    return subject.role === "doctor" ? "This doctor" : "This patient";
  }
  return entry.actorEmail ?? "User";
}

function changedField(changes: unknown, field: string): string | undefined {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return undefined;
  const record = changes as Record<string, unknown>;
  const entry = record[field] ?? record[toCamel(field)];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return undefined;
  const value = (entry as { new?: unknown }).new;
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") return String(value).toLowerCase();
  return undefined;
}

function toCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
