import { ADMIN_ROLES, type AdminRole } from "@/lib/admin/api/types";

/**
 * A mirror of `telemed-admin-service/internal/rbac/matrix.go`.
 *
 * This table decides two things and neither of them is security: which nav
 * items render, and which routes `proxy.ts` refuses before a page is
 * ever built. The gateway and admin-service enforce the same matrix on every
 * request, and they are the enforcement. Hiding a button the backend would
 * refuse anyway is a courtesy to the admin, not a control.
 *
 * It is kept deliberately close to the Go original — same group names, same
 * role lists, same comments about *why* finance and admin_users are narrower —
 * so that a change on one side is obvious when read against the other.
 */

export const RBAC_GROUPS = [
  "credentialing",
  "admin_users",
  "users",
  "appointments",
  "finance",
  "content",
  "disputes",
  "config",
  "analytics",
  "audit",
  "audit_export",
] as const;

export type RbacGroup = (typeof RBAC_GROUPS)[number];

/** Every admin role. Matches `middleware.AdminRoles`. */
const ALL: readonly AdminRole[] = ADMIN_ROLES;

export const RBAC_MATRIX: Readonly<Record<RbacGroup, readonly AdminRole[]>> = {
  credentialing: ALL,
  // Managing other admin accounts is super_admin alone: any lesser role
  // granting itself or a peer more access is a privilege-escalation hole.
  admin_users: ["super_admin"],
  users: ALL,
  appointments: ALL,
  // Support and ops staff have no legitimate reason to move money or edit
  // commission rules.
  finance: ["finance", "super_admin"],
  content: ALL,
  disputes: ALL,
  // Config spans financial policy (fee caps, commission rules) and
  // operational policy (feature flags, cancellation). Finance and ops both
  // have a reason to touch it; support does not.
  config: ["super_admin", "ops", "finance"],
  analytics: ALL,
  audit: ALL,
  // Reading a filtered page of the audit log is oversight; walking off with the
  // whole trail as a CSV is not the same act. Mirrors GroupAuditExport, added
  // to the Go matrix by security review F6. Without this entry the console
  // offered every role an Export button that only two roles can actually use.
  audit_export: ["finance", "super_admin"],
};

/**
 * Route prefix → group. Longest prefix wins, so `/settings/admins` maps to
 * `admin_users` rather than to `config`.
 */
const ROUTE_GROUPS: ReadonlyArray<readonly [string, RbacGroup]> = [
  ["/settings/admins", "admin_users"],
  ["/settings", "config"],
  ["/doctors", "credentialing"],
  ["/users", "users"],
  ["/appointments", "appointments"],
  ["/payments", "finance"],
  ["/content", "content"],
  ["/disputes", "disputes"],
  ["/audit", "audit"],
  ["/", "analytics"],
];

/** The group guarding `pathname`, or null when the path is not guarded. */
export function groupForPath(pathname: string): RbacGroup | null {
  const normalised = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  let best: readonly [string, RbacGroup] | null = null;
  for (const entry of ROUTE_GROUPS) {
    const [prefix] = entry;
    const matches =
      prefix === "/" ? normalised === "/" : normalised === prefix || normalised.startsWith(`${prefix}/`);
    if (matches && (best === null || prefix.length > best[0].length)) {
      best = entry;
    }
  }
  return best ? best[1] : null;
}

/** Does any of `roles` permit `group`? */
export function can(roles: readonly AdminRole[], group: RbacGroup): boolean {
  const allowed = RBAC_MATRIX[group];
  return roles.some((role) => allowed.includes(role));
}

/** Does any of `roles` permit the page at `pathname`? Unguarded paths pass. */
export function canVisit(roles: readonly AdminRole[], pathname: string): boolean {
  const group = groupForPath(pathname);
  if (group === null) return true;
  return can(roles, group);
}

// ---------------------------------------------------------------------------
// The API surface
// ---------------------------------------------------------------------------

/**
 * Upstream gateway path prefix -> group, for the BFF proxy.
 *
 * `ROUTE_GROUPS` above answers "may this role open this *page*". This table
 * answers "may this role make this *call*", which is a different question and
 * the one that matters: a page is a convenience, a call moves money.
 *
 * Unlike `canVisit`, `canCallApi` **fails closed**. An upstream path this table
 * does not recognise is refused rather than forwarded, so adding a route to
 * `lib/api/endpoints.ts` without deciding who may call it is a 403 in
 * development, not a silent pass-through in production. That is the opposite of
 * the previous behaviour, where every `/api/gateway/*` path fell through
 * `groupForPath` to `null` and was therefore allowed for all five roles.
 */
const API_ROUTE_GROUPS: ReadonlyArray<readonly [string, RbacGroup]> = [
  // Commission rules are stored as a sysconfig key, and `GroupConfig` includes
  // `ops`. That is platform review F18: an ops admin refused on
  // `PUT /finance/commission-rules` gets the same row through
  // `PUT /configs/commission_rules`, and the audit action is a generic
  // `config.updated` that a finance-actions review will not surface. The
  // backend fix is a per-key policy in `sysconfig.Service.Put`. Until that
  // lands, this console will not carry the request: longest prefix wins, so
  // the commission key is bound to the finance group whichever spelling the
  // endpoint table uses.
  ["/api/v1/admin/configs/commission_rules", "finance"],
  ["/api/v1/admin/config/commission_rules", "finance"],

  ["/api/v1/admin/audit/export", "audit_export"],
  ["/api/v1/admin/audit", "audit"],
  // In-app inbox for credentialing events (doctor applications today).
  // Mirrors admin-service: RequireRole(GroupCredentialing) on /notifications.
  ["/api/v1/admin/notifications", "credentialing"],
  ["/api/v1/admin/doctors", "credentialing"],
  // Both spellings, because the console's endpoint table and the service's
  // router currently disagree (`/admin-users` vs `/admins`, `/config` vs
  // `/configs` — see the review's A16). Whichever way that is resolved, the
  // role check is already correct for it; the alternative is a fail-closed 403
  // appearing the day someone fixes a 404.
  ["/api/v1/admin/admin-users", "admin_users"],
  ["/api/v1/admin/admins", "admin_users"],
  ["/api/v1/admin/users", "users"],
  ["/api/v1/admin/appointments", "appointments"],
  ["/api/v1/admin/finance", "finance"],
  ["/api/v1/admin/content", "content"],
  ["/api/v1/admin/disputes", "disputes"],
  ["/api/v1/admin/config", "config"],
  ["/api/v1/admin/configs", "config"],
  ["/api/v1/admin/analytics", "analytics"],
];

/**
 * Paths any admin role may call regardless of group. Exactly one today:
 * `GET /me` returns the caller's own `admin_users` row and nothing else.
 */
const ANY_ADMIN_API_PATHS: ReadonlySet<string> = new Set(["/api/v1/admin/me"]);

/**
 * The group guarding an upstream API path, or `null` when the path is not in
 * the table. `null` means "refuse", not "allow" — see `canCallApi`.
 */
export function groupForApiPath(path: string): RbacGroup | null {
  const normalised = withoutQuery(path);
  let best: readonly [string, RbacGroup] | null = null;
  for (const entry of API_ROUTE_GROUPS) {
    const [prefix] = entry;
    if (normalised !== prefix && !normalised.startsWith(`${prefix}/`)) continue;
    if (best === null || prefix.length > best[0].length) best = entry;
  }
  return best ? best[1] : null;
}

/** May any of `roles` call the upstream admin path? Unknown paths are refused. */
export function canCallApi(roles: readonly AdminRole[], path: string): boolean {
  const normalised = withoutQuery(path);
  if (ANY_ADMIN_API_PATHS.has(normalised)) return roles.length > 0;
  const group = groupForApiPath(normalised);
  if (group === null) return false;
  return can(roles, group);
}

function withoutQuery(path: string): string {
  const cut = path.search(/[?#]/);
  const base = cut === -1 ? path : path.slice(0, cut);
  return base.length > 1 ? base.replace(/\/+$/, "") : base;
}

/** Human label for a role, for the header badge and the admin list. */
export function roleLabel(role: AdminRole): string {
  switch (role) {
    case "super_admin":
      return "Super admin";
    case "admin":
      return "Admin";
    case "ops":
      return "Operations";
    case "finance":
      return "Finance";
    case "support":
      return "Support";
  }
}

/** The most privileged role held, for display when someone holds several. */
export function primaryRole(roles: readonly AdminRole[]): AdminRole | null {
  for (const role of ADMIN_ROLES) {
    if (roles.includes(role)) return role;
  }
  return null;
}
