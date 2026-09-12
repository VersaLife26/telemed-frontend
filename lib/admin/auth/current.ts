import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import type { AdminRole } from "@/lib/admin/api/types";
import { identityFrom, type IdentityResult } from "./access";

/**
 * The caller, for the current server render.
 *
 * Separate from `./access` because this is the only file that imports
 * `next/headers`: that module exists only inside a server component render,
 * and `./access` is also imported by the BFF route handler and by the test
 * suite, neither of which has one.
 *
 * Wrapped in React's `cache` so the layout, the page and anything else in one
 * render tree share a single `/me` call rather than each making their own. The
 * cache is per-request, so one admin's role can never be served to another.
 */
export const adminIdentity = cache(async function adminIdentity(): Promise<IdentityResult> {
  const requestHeaders = await headers();
  return identityFrom({ headers: requestHeaders });
});

/**
 * The caller's roles, for a page deciding what to render.
 *
 * Safe to treat an empty array as "no permissions": every page that calls this
 * renders inside the console layout, which has already redirected anyone with
 * no roles to /no-access. Sharing `adminIdentity`'s request cache means this
 * costs nothing beyond the call the layout already made.
 */
export async function adminRoles(): Promise<AdminRole[]> {
  const result = await adminIdentity();
  return result.ok ? result.identity.roles : [];
}
