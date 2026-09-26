import type { Metadata } from "next";

import { AdminsTable } from "@/components/admin/admins/admins-table";
import { CreateAdminDialog } from "@/components/admin/admins/create-admin-dialog";
import { PermissionGrid } from "@/components/admin/admins/permission-grid";
import { ErrorState } from "@/components/admin/common/error-state";
import { PageHeader } from "@/components/admin/common/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { endpoints } from "@/lib/admin/api/endpoints";
import { routeFatal } from "@/lib/admin/api/guard";
import { tryGetServer } from "@/lib/admin/api/server";
import type { AdminAccount, PermissionRoles } from "@/lib/admin/api/types";

export const metadata: Metadata = { title: "Admin accounts" };

/**
 * Admin account management. superAdmin only, via the `adminUsers`
 * permission. Everything here is enforced again by the API; the client guard
 * controls navigation, not access.
 */
export default async function AdminAccountsPage() {
  const header = (
    <PageHeader
      title="Admin accounts"
      description="Who can sign in to this console, and what each of them can reach. Changing someone's role takes effect immediately — their sessions are ended, so it is not waiting on a token to expire."
    />
  );

  const [accounts, matrix] = await Promise.all([
    tryGetServer<AdminAccount[]>(endpoints.adminUsers.list()),
    tryGetServer<PermissionRoles[]>(endpoints.permissions()),
  ]);

  if (!accounts.ok) {
    return (
      <>
        {header}
        <ErrorState error={routeFatal(accounts.error)} what="the admin roster" />
      </>
    );
  }

  return (
    <>
      {header}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Admins</CardTitle>
            <CardDescription>
              Accounts are created here, never by self-registration. This sets
              what someone may do; Cloudflare Access decides who gets in, so a
              new admin also needs their email on the console&rsquo;s Access
              policy before they can sign in.
            </CardDescription>
          </div>
          <CreateAdminDialog />
        </CardHeader>
        <CardContent>
          <AdminsTable accounts={accounts.data} />
        </CardContent>
      </Card>

      {matrix.ok ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>What each role can reach</CardTitle>
            <CardDescription>
              Served by the API from the permission table it actually
              enforces, so this grid cannot drift away from what the server
              does.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PermissionGrid matrix={matrix.data} />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
