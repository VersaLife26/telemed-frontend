/**
 * Wire types for the admin API surface, aliased from the generated OpenAPI
 * schema so a contract change is a type error here rather than a silent
 * `undefined` on a screen.
 *
 * Money is always integer cents with a separate currency, never a float.
 */

import type { components } from "@/lib/api/schema";

export type { Paged } from "@/lib/consumer/api/types";
export { totalPages } from "@/lib/consumer/api/types";

type S = components["schemas"];

export type Uuid = string;
/** ISO-8601 timestamp, always UTC on the wire. */
export type Timestamp = string;
/** Integer minor units (cents). */
export type Cents = number;

// ---------------------------------------------------------------------------
// Roles and permissions
// ---------------------------------------------------------------------------

export type AdminRole = S["AdminRole"];
export type AdminPermission = S["AdminPermission"];

export const ADMIN_ROLES = [
  "superAdmin",
  "admin",
  "ops",
  "finance",
  "support",
] as const satisfies readonly AdminRole[];

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

/**
 * The roles a super admin may assign, ordered least-privilege first so the
 * picker does not read as though superAdmin were the natural choice.
 */
export const ASSIGNABLE_ADMIN_ROLES = [
  "support",
  "ops",
  "finance",
  "admin",
  "superAdmin",
] as const satisfies readonly AdminRole[];

export type AdminMe = S["AdminMeDto"];
export type PermissionRoles = S["PermissionRolesDto"];

export type AdminAccount = S["AdminUserDto"];
export type CreateAdminRequest = S["CreateAdminUserRequest"];
export type UpdateAdminRequest = S["UpdateAdminUserRequest"];

// ---------------------------------------------------------------------------
// Credentialing and doctors
// ---------------------------------------------------------------------------

export type DoctorApplicationStatus = S["DoctorApplicationStatus"];
export type DoctorApplicationSummary = S["DoctorApplicationSummaryDto"];
export type DoctorApplication = S["DoctorApplicationDto"];
export type Checklist = S["ChecklistDto"];
export type ChecklistItem = S["ChecklistItemDto"];
export type ChecklistItemKey = keyof Checklist;
export type UpdateChecklistRequest = S["UpdateChecklistRequest"];
export type DoctorDocument = S["DoctorDocumentDto"];
export type DoctorDocumentType = S["DoctorDocumentType"];
export type SignedUrl = S["SignedUrlDto"];

export type DoctorStatus = S["DoctorStatus"];
export type AdminDoctorListItem = S["AdminDoctorListItemDto"];
export type AdminDoctor = S["AdminDoctorDto"];

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type UserStatus = S["UserStatus"];
export type UserRole = S["UserRole"];
export type PlatformUser = S["PlatformUserDto"];
export type PlatformUserDetail = S["PlatformUserDetailDto"];
export type UserActivity = S["UserActivityDto"];
export type SuspendUserRequest = S["SuspendUserRequest"];

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

export type AppointmentStatus = S["AppointmentStatus"];
export type Appointment = S["AppointmentDto"];
export type AdminAppointmentDetail = S["AdminAppointmentDetailDto"];
export type RescheduleRequest = S["RescheduleRequestDto"];
export type RescheduleStatus = S["RescheduleStatus"];

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export type PaymentStatus = S["PaymentStatus"];
export type PaymentProvider = S["PaymentProvider"];
export type Payment = S["PaymentDto"];
export type LedgerEntry = S["LedgerEntryDto"];
export type LedgerPage = S["LedgerPageDto"];
export type LedgerTotals = S["LedgerTotalsDto"];
export type Commission = S["CommissionDto"];
export type PayoutBatch = S["PayoutBatchDto"];
export type PayoutBatchDetail = S["PayoutBatchDetailDto"];
export type Payout = S["PayoutDto"];
export type PayoutRun = S["PayoutRunDto"];
export type AdminRefund = S["AdminRefundDto"];
export type RefundStatus = S["RefundStatus"];
export type PromoCode = S["PromoCodeDto"];
export type CreatePromoCodeRequest = S["CreatePromoCodeRequest"];
export type UpdatePromoCodeRequest = S["UpdatePromoCodeRequest"];

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export type Specialty = S["AdminSpecialtyDto"];
export type Drug = S["AdminDrugDto"];

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

export type DisputeStatus = S["DisputeStatus"];
export type Dispute = S["DisputeDto"];
export type DisputeDetail = S["DisputeDetailDto"];
export type DisputeComment = S["DisputeCommentDto"];

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export type WorkingHour = S["WorkingHourDto"];
export type Schedule = S["ScheduleDto"];
export type ScheduleUpdated = S["ScheduleUpdatedDto"];
export type UpdateScheduleRequest = S["UpdateScheduleRequest"];
export type Holiday = S["HolidayDto"];
export type SlotBlock = S["SlotBlockDto"];

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type DashboardSummary = S["DashboardDto"];
export type RevenuePoint = S["RevenuePointDto"];
export type BookingsDay = S["BookingsDayDto"];
export type TopDoctor = S["TopDoctorDto"];

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export type AuditEntry = S["AuditEntryDto"];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type AdminNotification = S["AdminNotificationDto"];
export type AdminNotificationUnreadCount = S["UnreadCountDto"];
