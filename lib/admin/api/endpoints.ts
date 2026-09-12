/**
 * Every admin endpoint this console calls, in one place.
 *
 * All of these are proxied by telemed-api-gateway's `/api/v1/admin/*` rule
 * (auth mode "admin": IP allowlist, then RequireAuth, then
 * RequireRole(AdminRoles...)) to telemed-admin-service on port 8088.
 *
 * Endpoints marked NOT-YET-IMPLEMENTED were derived from the V2 docs §7.3/§8.8
 * and from telemed-admin-service's migrations (000003–000007), which define
 * the tables but whose handlers are not yet mounted in that service's
 * cmd/server/main.go at the time this console was written. They are listed
 * honestly rather than omitted: the console renders a specific "this endpoint
 * is not deployed yet" empty state when one 404s, instead of a generic error.
 */

const ADMIN = "/api/v1/admin";

export const endpoints = {
  /** The admin_users row behind the current Keycloak subject. */
  me: () => `${ADMIN}/me`,

  credentialing: {
    /** Documented in the gateway route table. */
    pending: (q: URLSearchParams) => `${ADMIN}/doctors/pending?${q}`,
    detail: (doctorId: string) => `${ADMIN}/doctors/${doctorId}`,
    checklist: (doctorId: string) => `${ADMIN}/doctors/${doctorId}/checklist`,
    /** Documented in the gateway route table. */
    verify: (doctorId: string) => `${ADMIN}/doctors/${doctorId}/verify`,
  },

  /**
   * Admin in-app inbox (admin-service). Mounted under credentialing RBAC —
   * projected kinds today are doctor_application and reschedule_request.
   */
  notifications: {
    list: () => `${ADMIN}/notifications`,
    unreadCount: () => `${ADMIN}/notifications/unread-count`,
    markRead: (id: string) => `${ADMIN}/notifications/${id}/read`,
    markAllRead: () => `${ADMIN}/notifications/read-all`,
  },

  users: {
    list: (q: URLSearchParams) => {
      const sp = new URLSearchParams(q);
      // admin-service reads `query`; the console filter bar writes `q`.
      if (sp.has("q") && !sp.has("query")) {
        sp.set("query", sp.get("q") ?? "");
        sp.delete("q");
      }
      return `${ADMIN}/users?${sp}`;
    },
    detail: (userId: string) => `${ADMIN}/users/${userId}`,
    activity: (userId: string) => `${ADMIN}/users/${userId}/activity`,
    suspend: (userId: string) => `${ADMIN}/users/${userId}/suspend`,
    reinstate: (userId: string) => `${ADMIN}/users/${userId}/reinstate`,
    // NOTE: there is deliberately no `impersonate` entry. The V2 docs §7.3
    // list "impersonate for support (audit logged)" as an admin capability,
    // but no route, table, event subject or RBAC group for it exists anywhere
    // in telemed-admin-service or telemed-user-service. Per the build brief,
    // the button is omitted rather than wired to an endpoint that does not
    // exist. See README "Documented but not exposed by the backend".
  },

  appointments: {
    list: (q: URLSearchParams) => `${ADMIN}/appointments?${q}`,
    detail: (id: string) => `${ADMIN}/appointments/${id}`,
    forceCancel: (id: string) => `${ADMIN}/appointments/${id}/force-cancel`,
    doubleBookings: () => `${ADMIN}/appointments/double-bookings`,
    resolveDoubleBooking: () => `${ADMIN}/appointments/resolve-double-booking`,
    audit: (id: string) => `${ADMIN}/appointments/${id}/audit`,
    /** Named gateway routes send these to scheduling-service, not admin-service. */
    rescheduleRequests: (q: URLSearchParams) => `${ADMIN}/reschedule-requests?${q}`,
    acceptReschedule: (id: string) => `${ADMIN}/reschedule-requests/${id}/accept`,
    declineReschedule: (id: string) => `${ADMIN}/reschedule-requests/${id}/decline`,
  },

  finance: {
    ledger: (q: URLSearchParams) => `${ADMIN}/finance/ledger?${q}`,
    ledgerExport: (q: URLSearchParams) => `${ADMIN}/finance/ledger/export?${q}`,
    commissionRules: () => `${ADMIN}/finance/commission-rules`,
    commissionRuleHistory: () => `${ADMIN}/finance/commission-rules/history`,
    payoutBatches: (q: URLSearchParams) => `${ADMIN}/finance/payout-batches?${q}`,
    runPayoutBatch: () => `${ADMIN}/finance/payouts/run`,
    refunds: (q: URLSearchParams) => `${ADMIN}/finance/refunds?${q}`,
    decideRefund: (id: string) => `${ADMIN}/finance/refunds/${id}/decision`,
  },

  content: {
    specialties: (q: URLSearchParams) => `${ADMIN}/content/specialties?${q}`,
    specialty: (id?: string) =>
      id ? `${ADMIN}/content/specialties/${id}` : `${ADMIN}/content/specialties`,
    symptoms: (q: URLSearchParams) => `${ADMIN}/content/symptoms?${q}`,
    symptom: (id?: string) =>
      id ? `${ADMIN}/content/symptoms/${id}` : `${ADMIN}/content/symptoms`,
    drugs: (q: URLSearchParams) => `${ADMIN}/content/drugs?${q}`,
    drug: (id?: string) => (id ? `${ADMIN}/content/drugs/${id}` : `${ADMIN}/content/drugs`),
    articles: (q: URLSearchParams) => `${ADMIN}/content/articles?${q}`,
    article: (id?: string) =>
      id ? `${ADMIN}/content/articles/${id}` : `${ADMIN}/content/articles`,
  },

  disputes: {
    list: (q: URLSearchParams) => `${ADMIN}/disputes?${q}`,
    detail: (id: string) => `${ADMIN}/disputes/${id}`,
    comments: (id: string) => `${ADMIN}/disputes/${id}/comments`,
    assign: (id: string) => `${ADMIN}/disputes/${id}/assign`,
    resolve: (id: string) => `${ADMIN}/disputes/${id}/resolve`,
  },

  settings: {
    config: (key: string) => `${ADMIN}/configs/${encodeURIComponent(key)}`,
    configHistory: (key: string) => `${ADMIN}/configs/${encodeURIComponent(key)}/history`,
    admins: (q: URLSearchParams) => `${ADMIN}/admin-users?${q}`,
  },

  /**
   * Admin accounts. Super_admin only, enforced server-side by
   * RequireRole(rbac.GroupAdminUsers) -- the guard in lib/rbac.ts hides the
   * navigation, it does not protect the API.
   */
  /**
   * A doctor's schedule, edited by staff. These route to doctor-service, not
   * admin-service: the gateway matches the more specific pattern first.
   */
  doctorSchedule: {
    availability: (id: string) => `${ADMIN}/doctors/${id}/availability`,
    settings: (id: string) => `${ADMIN}/doctors/${id}/schedule-settings`,
    application: (id: string) => `${ADMIN}/doctors/${id}/application?include=bytes`,
  },

  adminUsers: {
    list: () => `${ADMIN}/admin-users`,
    create: () => `${ADMIN}/admin-users`,
    update: (id: string) => `${ADMIN}/admin-users/${id}`,
    /** The live matrix, so the grid shows what the server enforces. */
    permissions: () => `${ADMIN}/admin-users/permissions`,
  },

  analytics: {
    /** Documented in the gateway route table. */
    revenue: (q: URLSearchParams) => `${ADMIN}/analytics/revenue?${q}`,
    dashboard: (q: URLSearchParams) => `${ADMIN}/analytics/dashboard?${q}`,
  },

  audit: {
    /** Implemented today in telemed-admin-service/internal/audit. */
    list: (q: URLSearchParams) => `${ADMIN}/audit?${q}`,
    export: (q: URLSearchParams) => `${ADMIN}/audit/export?${q}`,
    verify: () => `${ADMIN}/audit/verify`,
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
