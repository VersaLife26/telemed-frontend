import assert from "node:assert/strict";
import test from "node:test";

import { NAV_ITEMS } from "@/components/admin/layout/nav-items";
import { ASSIGNABLE_ADMIN_ROLES } from "@/lib/admin/api/types";
import { RBAC_MATRIX, groupForPath } from "@/lib/admin/rbac";

test("/settings/admins is guarded as admin_users, not as config", () => {
  // groupForPath picks the LONGEST matching prefix, so array order is not the
  // risk -- removing the /settings/admins entry is. Without it the path falls
  // back to /settings, inherits the config group, and the admin roster becomes
  // reachable by ops and finance, who could then change their own role.
  assert.equal(groupForPath("/settings/admins"), "admin_users");
  assert.equal(groupForPath("/settings"), "config");
});

test("admin_users is super_admin only", () => {
  assert.deepEqual(RBAC_MATRIX.admin_users, ["super_admin"]);
});

test("the Admin accounts nav entry is bound to the admin_users group", () => {
  const entry = NAV_ITEMS.find((item) => item.href === "/settings/admins");
  assert.ok(entry, "the Admin accounts nav entry is missing");
  // The nav is what hides the link; the group is what decides who sees it.
  // Binding it to anything wider would advertise the page to roles that get a
  // 403 from admin-service when they follow it.
  assert.equal(entry.group, "admin_users");
});

test("every nav entry names a group the RBAC table knows", () => {
  for (const item of NAV_ITEMS) {
    assert.ok(
      Object.hasOwn(RBAC_MATRIX, item.group),
      `nav entry ${item.href} names unknown group ${item.group}`,
    );
  }
});

test("the assignable role list matches what the RBAC table recognises", () => {
  // ASSIGNABLE_ADMIN_ROLES drives the role picker. A role here that no group
  // grants would produce an account that can sign in and reach nothing.
  const known = new Set(Object.values(RBAC_MATRIX).flat());
  for (const role of ASSIGNABLE_ADMIN_ROLES) {
    assert.ok(known.has(role), `role ${role} is offered but grants nothing`);
  }
});
