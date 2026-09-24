import { SURFACE } from "@/lib/consumer/surface";

/**
 * The authenticated frame, dispatched per surface.
 *
 * force-dynamic comes from the admin console, whose layout re-checks the
 * session on every request rather than trusting that proxy.ts ran. It applies
 * to the consumer surfaces too, which costs them nothing: every page under
 * this group already reads the session cookie, so none of them was static.
 *
 * A route-segment config value must be a literal Next can read without
 * executing the module, so this cannot be conditional.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (SURFACE === "admin") {
    const { default: AdminConsoleLayout } = await import("@/components/admin/layouts/console");
    return <AdminConsoleLayout>{children}</AdminConsoleLayout>;
  }
  const { default: ConsumerShellLayout } = await import("@/components/consumer/layouts/shell");
  const { CallProvider } = await import("@/components/consumer/call/call-provider");
  return (
    <CallProvider>
      <ConsumerShellLayout>{children}</ConsumerShellLayout>
    </CallProvider>
  );
}
