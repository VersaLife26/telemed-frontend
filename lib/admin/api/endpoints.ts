/**
 * Every admin endpoint this console calls, in one place. All paths are under
 * `/api/v1/admin`; `openapi/v1.json` in telemed-api is the contract.
 */

const ADMIN = "/api/v1/admin";

export const endpoints = {
  /** The admin_users row for the caller Cloudflare Access authenticated. */
  me: () => `${ADMIN}/me`,
  /** The live permission matrix, so the grid shows what the server enforces. */
  permissions: () => `${ADMIN}/permissions`,

  credentialing: {
    list: (q: URLSearchParams) => `${ADMIN}/doctor-applications?${q}`,
    detail: (id: string) => `${ADMIN}/doctor-applications/${id}`,
    document: (id: string, documentId: string) =>
      `${ADMIN}/doctor-applications/${id}/documents/${documentId}`,
    checklist: (id: string) => `${ADMIN}/doctor-applications/${id}/checklist`,
    startReview: (id: string) => `${ADMIN}/doctor-applications/${id}/start-review`,
    approve: (id: string) => `${ADMIN}/doctor-applications/${id}/approve`,
    reject: (id: string) => `${ADMIN}/doctor-applications/${id}/reject`,
  },

  doctors: {
    list: (q: URLSearchParams) => `${ADMIN}/doctors?${q}`,
    detail: (id: string) => `${ADMIN}/doctors/${id}`,
    document: (id: string, documentId: string) => `${ADMIN}/doctors/${id}/documents/${documentId}`,
    suspend: (id: string) => `${ADMIN}/doctors/${id}/suspend`,
    reinstate: (id: string) => `${ADMIN}/doctors/${id}/reinstate`,
  },

  notifications: {
    list: (q: URLSearchParams) => `${ADMIN}/notifications?${q}`,
    unreadCount: () => `${ADMIN}/notifications/unread-count`,
    markRead: (id: string) => `${ADMIN}/notifications/${id}/read`,
    markAllRead: () => `${ADMIN}/notifications/read-all`,
  },

  users: {
    list: (q: URLSearchParams) => `${ADMIN}/users?${q}`,
    detail: (userId: string) => `${ADMIN}/users/${userId}`,
    activity: (userId: string) => `${ADMIN}/users/${userId}/activity`,
    suspend: (userId: string) => `${ADMIN}/users/${userId}/suspend`,
    reinstate: (userId: string) => `${ADMIN}/users/${userId}/reinstate`,
  },

  appointments: {
    list: (q: URLSearchParams) => `${ADMIN}/appointments?${q}`,
    detail: (id: string) => `${ADMIN}/appointments/${id}`,
    cancel: (id: string) => `${ADMIN}/appointments/${id}/cancel`,
    audit: (id: string) => `${ADMIN}/appointments/${id}/audit`,
    rescheduleRequests: (q: URLSearchParams) => `${ADMIN}/reschedule-requests?${q}`,
    acceptReschedule: (id: string) => `${ADMIN}/reschedule-requests/${id}/accept`,
    declineReschedule: (id: string) => `${ADMIN}/reschedule-requests/${id}/decline`,
  },

  finance: {
    ledger: (q: URLSearchParams) => `${ADMIN}/finance/ledger?${q}`,
    ledgerExport: (q: URLSearchParams) => `${ADMIN}/finance/ledger.csv?${q}`,
    commission: () => `${ADMIN}/finance/commission`,
    payoutBatches: (q: URLSearchParams) => `${ADMIN}/finance/payout-batches?${q}`,
    payoutBatch: (id: string) => `${ADMIN}/finance/payout-batches/${id}`,
    runPayouts: () => `${ADMIN}/finance/payouts/run`,
    markPayoutPaid: (id: string) => `${ADMIN}/finance/payouts/${id}/mark-paid`,
    markPayoutFailed: (id: string) => `${ADMIN}/finance/payouts/${id}/mark-failed`,
    refunds: (q: URLSearchParams) => `${ADMIN}/finance/refunds?${q}`,
    approveRefund: (id: string) => `${ADMIN}/finance/refunds/${id}/approve`,
    rejectRefund: (id: string) => `${ADMIN}/finance/refunds/${id}/reject`,
    markRefunded: (id: string) => `${ADMIN}/finance/refunds/${id}/mark-refunded`,
    createRefund: (paymentId: string) => `${ADMIN}/payments/${paymentId}/refunds`,
    promoCodes: (q: URLSearchParams) => `${ADMIN}/finance/promo-codes?${q}`,
    createPromoCode: () => `${ADMIN}/finance/promo-codes`,
    promoCode: (id: string) => `${ADMIN}/finance/promo-codes/${id}`,
    deactivatePromoCode: (id: string) => `${ADMIN}/finance/promo-codes/${id}/deactivate`,
  },

  content: {
    specialties: () => `${ADMIN}/specialties`,
    specialty: (code?: string) =>
      code ? `${ADMIN}/specialties/${encodeURIComponent(code)}` : `${ADMIN}/specialties`,
    drugs: (q: URLSearchParams) => `${ADMIN}/drugs?${q}`,
    drug: (id?: string) => (id ? `${ADMIN}/drugs/${id}` : `${ADMIN}/drugs`),
  },

  disputes: {
    list: (q: URLSearchParams) => `${ADMIN}/disputes?${q}`,
    create: () => `${ADMIN}/disputes`,
    detail: (id: string) => `${ADMIN}/disputes/${id}`,
    comments: (id: string) => `${ADMIN}/disputes/${id}/comments`,
    assign: (id: string) => `${ADMIN}/disputes/${id}/assign`,
    resolve: (id: string) => `${ADMIN}/disputes/${id}/resolve`,
    close: (id: string) => `${ADMIN}/disputes/${id}/close`,
  },

  /** Admin accounts. superAdmin only, enforced server-side by the adminUsers permission. */
  adminUsers: {
    list: () => `${ADMIN}/admin-users`,
    create: () => `${ADMIN}/admin-users`,
    update: (id: string) => `${ADMIN}/admin-users/${id}`,
    deactivate: (id: string) => `${ADMIN}/admin-users/${id}/deactivate`,
  },

  /** A doctor's schedule, edited by staff. Keyed by the approved doctor's id. */
  doctorSchedule: {
    schedule: (doctorId: string) => `${ADMIN}/doctors/${doctorId}/schedule`,
    holidays: (doctorId: string, q?: URLSearchParams) =>
      `${ADMIN}/doctors/${doctorId}/holidays${q ? `?${q}` : ""}`,
    slotBlocks: (doctorId: string, q?: URLSearchParams) =>
      `${ADMIN}/doctors/${doctorId}/slot-blocks${q ? `?${q}` : ""}`,
    deleteSlotBlock: (id: string) => `${ADMIN}/slot-blocks/${id}`,
    platformHolidays: (q?: URLSearchParams) => `${ADMIN}/holidays${q ? `?${q}` : ""}`,
    deleteHoliday: (id: string) => `${ADMIN}/holidays/${id}`,
  },

  analytics: {
    dashboard: (q: URLSearchParams) => `${ADMIN}/analytics/dashboard?${q}`,
    revenue: (q: URLSearchParams) => `${ADMIN}/analytics/revenue?${q}`,
    bookings: (q: URLSearchParams) => `${ADMIN}/analytics/bookings?${q}`,
    topDoctors: (q: URLSearchParams) => `${ADMIN}/analytics/top-doctors?${q}`,
  },

  audit: {
    list: (q: URLSearchParams) => `${ADMIN}/audit?${q}`,
    export: (q: URLSearchParams) => `${ADMIN}/audit.csv?${q}`,
  },
} as const;

/**
 * Builds a query string, dropping empty values so a cleared filter does not
 * become `?status=` and change the meaning of the request.
 */
export function query(
  params: Record<string, string | number | boolean | null | undefined>,
): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    sp.set(key, String(value));
  }
  return sp;
}
