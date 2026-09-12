import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ConsoleShell } from "@/components/admin/layout/console-shell";
import { adminIdentity } from "@/lib/admin/auth/current";
import { canVisit, groupForPath } from "@/lib/admin/rbac";

/**
 * Authenticated frame.
 *
 * This layout now owns the role check that `proxy.ts` used to do. Under
 * Keycloak the roles rode in the session cookie and could be read
 * synchronously in middleware; they now come from this platform's admin_users
 * row over the network, which does not belong on every request for every
 * asset. Here it is one call per page render, shared with the page itself by
 * React's request cache, and the answer is needed anyway to draw the nav.
 *
 * Neither this nor the middleware is the control. The gateway and
 * admin-service enforce the same matrix on every call; this decides what to
 * render rather than what is permitted.
 */
export default async function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [result, requestHeaders] = await Promise.all([adminIdentity(), headers()]);

  if (!result.ok) {
    // There is no /login to send anyone to: Cloudflare Access challenges at
    // the edge. A missing token means the request did not come through Access
    // at all, and an unreachable backend means we cannot say what this person
    // may do -- neither is fixed by re-rendering the console.
    throw new Error(
      result.reason === "unreachable"
        ? "Could not reach the platform to confirm your admin role."
        : "This console is reached through Cloudflare Access.",
    );
  }

  const { identity } = result;
  if (identity.roles.length === 0) {
    redirect("/no-access");
  }

  const pathname = requestHeaders.get("x-pathname") ?? "/";
  if (!canVisit(identity.roles, pathname)) {
    const group = groupForPath(pathname);
    redirect(group ? `/no-access?area=${encodeURIComponent(group)}` : "/no-access");
  }

  return (
    <ConsoleShell name={identity.name} email={identity.email} roles={identity.roles}>
      {children}
    </ConsoleShell>
  );
}
