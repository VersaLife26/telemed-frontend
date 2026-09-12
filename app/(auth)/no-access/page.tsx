import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";

import { adminRoles } from "@/lib/admin/auth/current";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { RBAC_MATRIX, type RbacGroup, roleLabel } from "@/lib/admin/rbac";

export const metadata: Metadata = { title: "No access" };

const AREA_NAMES: Record<RbacGroup, string> = {
  credentialing: "the doctor verification queue",
  admin_users: "admin account management",
  users: "user management",
  appointments: "appointments",
  finance: "payments and finance",
  content: "content management",
  disputes: "disputes",
  config: "settings",
  analytics: "the dashboard",
  audit: "audit logs",
  audit_export: "the audit log export",
};

/**
 * Reached when the role check in `proxy.ts` refuses a page.
 *
 * It names the area and the roles that would grant it, so the admin can make a
 * specific request ("I need finance") rather than a vague one ("I can't get
 * into payments").
 */
export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const [held, params] = await Promise.all([adminRoles(), searchParams]);
  const area = params.area && isGroup(params.area) ? params.area : null;

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-warning/10">
          <Lock className="size-6 text-warning" aria-hidden="true" />
        </div>
        <CardTitle className="text-xl">
          {area ? `You cannot open ${AREA_NAMES[area]}` : "No admin access"}
        </CardTitle>
        <CardDescription>
          {held.length === 0
            ? "Your account carries no admin role."
            : `You are signed in as ${held.map(roleLabel).join(", ")}.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {area ? (
          <p className="text-muted-foreground">
            {AREA_NAMES[area].charAt(0).toUpperCase() + AREA_NAMES[area].slice(1)} requires{" "}
            {RBAC_MATRIX[area].map(roleLabel).join(" or ")}. Ask a super admin to
            change your role in Settings &rarr; Admins; it takes effect within
            seconds, without you signing in again.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Cloudflare Access has let you in, which means it recognises you --
            but this platform has no admin role for your account. A super admin
            has to add you in Settings &rarr; Admins before the console will
            show you anything.
          </p>
        )}
      </CardContent>

      <CardFooter className="justify-center gap-2">
        <Button asChild variant="outline">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function isGroup(value: string): value is RbacGroup {
  return value in RBAC_MATRIX;
}
