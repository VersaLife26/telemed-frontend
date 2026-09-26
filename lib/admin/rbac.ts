import { ADMIN_ROLES, type AdminPermission, type AdminRole } from "@/lib/admin/api/types";

/**
 * A mirror of the API's `PermissionMatrix` (telemed-api,
 * src/TeleMed.Application/Permissions/PermissionMatrix.cs). The names are the
 * `AdminPermission` values `GET /admin/me` and `GET /admin/permissions` use.
 *
 * This table decides two things and neither of them is security: which nav
 * items render, and which calls the BFF refuses before they leave. The API
 * enforces the same matrix on every request, and it is the enforcement.
 * Hiding a button the backend would refuse anyway is a courtesy to the admin,
 * not a control.
 */

export const RBAC_GROUPS = [
  "credentialing",
  "doctors",
  "users",
  "appointments",
  "content",
  "disputes",
  "analytics",
  "audit",
  "finance",
  "auditExport",
  "adminUsers",
] as const satisfies readonly AdminPermission[];

export type RbacGroup = (typeof RBAC_GROUPS)[number];

const ALL: readonly AdminRole[] = ADMIN_ROLES;

export const RBAC_MATRIX: Readonly<Record<RbacGroup, readonly AdminRole[]>> = {
  credentialing: ALL,
  doctors: ALL,
  users: ALL,
  appointments: ALL,
  content: ALL,
  disputes: ALL,
  analytics: ALL,
  audit: ALL,
  // Support and ops staff have no legitimate reason to move money.
  finance: ["finance", "superAdmin"],
  // Reading a filtered page of the audit log is oversight; walking off with the
  // whole trail as a CSV is not the same act.
  auditExport: ["finance", "superAdmin"],
  // Managing other admin accounts is superAdmin alone: any lesser role
  // granting itself or a peer more access is a privilege-escalation hole.
  adminUsers: ["superAdmin"],
};

/** Route prefix → group. Longest prefix wins. */
const ROUTE_GROUPS: ReadonlyArray<readonly [string, RbacGroup]> = [
  ["/settings", "adminUsers"],
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
 * Upstream API path prefix -> group, for the BFF proxy.
 *
 * `ROUTE_GROUPS` above answers "may this role open this *page*". This table
 * answers "may this role make this *call*", which is a different question and
 * the one that matters: a page is a convenience, a call moves money.
 *
 * Unlike `canVisit`, `canCallApi` **fails closed**. An upstream path this table
 * does not recognise is refused rather than forwarded, so adding a route to
 * `./api/endpoints.ts` without deciding who may call it is a 403 in
 * development, not a silent pass-through in production.
 */
const API_ROUTE_GROUPS: ReadonlyArray<readonly [string, RbacGroup]> = [
  ["/api/v1/admin/audit.csv", "auditExport"],
  ["/api/v1/admin/audit", "audit"],
  ["/api/v1/admin/doctor-applications", "credentialing"],
  // Approved doctors, and their schedules, holidays and slot blocks.
  ["/api/v1/admin/doctors", "doctors"],
  ["/api/v1/admin/holidays", "doctors"],
  ["/api/v1/admin/slot-blocks", "doctors"],
  ["/api/v1/admin/admin-users", "adminUsers"],
  ["/api/v1/admin/users", "users"],
  ["/api/v1/admin/reschedule-requests", "appointments"],
  ["/api/v1/admin/appointments", "appointments"],
  ["/api/v1/admin/finance", "finance"],
  ["/api/v1/admin/payments", "finance"],
  ["/api/v1/admin/specialties", "content"],
  ["/api/v1/admin/drugs", "content"],
  ["/api/v1/admin/disputes", "disputes"],
  ["/api/v1/admin/analytics", "analytics"],
];

/**
 * Paths any admin role may call regardless of group, matching the API's
 * permission-free `[AdminAuthorize]`: the caller's own row, the permission
 * matrix, and the in-app inbox.
 */
const ANY_ADMIN_API_PREFIXES: readonly string[] = [
  "/api/v1/admin/me",
  "/api/v1/admin/permissions",
  "/api/v1/admin/notifications",
];

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
  if (ANY_ADMIN_API_PREFIXES.some((p) => normalised === p || normalised.startsWith(`${p}/`))) {
    return roles.length > 0;
  }
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
    case "superAdmin":
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
