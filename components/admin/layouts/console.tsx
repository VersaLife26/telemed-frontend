import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ConsoleShell } from "@/components/admin/layout/console-shell";

/**
 * Authenticated frame.
 *
 * `proxy.ts` has already rejected unauthenticated and unauthorised
 * requests before this renders. The check is repeated here anyway: a layout
 * that assumes middleware ran is a layout that breaks silently the day someone
 * edits the matcher.
 */
export default async function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user || session.error) {
    redirect("/login?reason=expired");
  }
  if ((session.roles ?? []).length === 0) {
    redirect("/no-access");
  }

  return (
    <ConsoleShell
      name={session.user.name ?? session.user.email ?? "Admin"}
      email={session.user.email ?? ""}
      roles={session.roles}
    >
      {children}
    </ConsoleShell>
  );
}
