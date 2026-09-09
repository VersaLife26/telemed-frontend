import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Activity, KeyRound, ShieldCheck } from "lucide-react";

import { auth, signIn } from "@/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/admin/ui/alert";
import { Button } from "@/components/admin/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { safeNextPath } from "@/lib/admin/auth/redirect";
import { clientEnv } from "@/lib/admin/env.client";

const metadata: Metadata = { title: "Sign in" };

/**
 * Sign-in.
 *
 * There is no password field, and there never will be: authentication is
 * Keycloak's, and the second factor is enforced in Keycloak's browser flow and
 * re-checked in `auth.ts`'s `signIn` callback. A local form here would be a
 * second credential path to keep secure for no benefit.
 *
 * The page's real job is to explain *why* a sign-in failed, because the three
 * reasons need three different actions: no admin role (ask a super_admin), no
 * second factor enrolled (enrol in Keycloak), session expired (sign in again).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const params = await searchParams;

  // `next` is attacker-supplied. `safeNextPath` proves it is a path on this
  // console before either of the two navigations below uses it; a bare
  // `startsWith("/")` accepts `//evil.example` and is an open redirect.
  const next = safeNextPath(single(params.next));
  if (session?.user && !session.error) {
    redirect(next);
  }

  const reason = single(params.reason);
  const error = single(params.error);
  const notice = describeNotice(reason, error);

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10">
          <Activity className="size-6 text-primary" aria-hidden="true" />
        </div>
        <CardTitle className="text-xl">Telemed Admin</CardTitle>
        <CardDescription>
          Operations console for the telemedicine platform.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {notice ? (
          <Alert variant={notice.variant}>
            <ShieldCheck aria-hidden="true" />
            <AlertTitle>{notice.title}</AlertTitle>
            <AlertDescription>{notice.body}</AlertDescription>
          </Alert>
        ) : null}

        <form
          action={async () => {
            "use server";
            await signIn("keycloak", { redirectTo: next });
          }}
        >
          <Button type="submit" className="w-full" size="lg">
            <KeyRound className="size-4" aria-hidden="true" />
            Continue with Keycloak SSO
          </Button>
        </form>

        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li>Two-factor authentication (TOTP) is required on every sign-in.</li>
          <li>
            Sessions end after {Math.round(clientEnv.idleTimeoutSeconds / 60)} minutes of
            inactivity.
          </li>
          <li>Your network address must be on the admin allowlist.</li>
        </ul>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-xs text-muted-foreground">
          Trouble signing in? Contact a super admin — they can check your role
          assignment and allowlist entry.
        </p>
      </CardFooter>
    </Card>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function describeNotice(
  reason: string | undefined,
  error: string | undefined,
): { title: string; body: string; variant: "warning" | "destructive" | "info" } | null {
  if (reason === "idle") {
    return {
      variant: "info",
      title: "Signed out after inactivity",
      body: "Your session ended because the console was idle. Sign in again to continue.",
    };
  }
  if (reason === "expired") {
    return {
      variant: "warning",
      title: "Session could not be renewed",
      body: "Keycloak refused to refresh your access token. This usually means the session was revoked or the refresh window elapsed.",
    };
  }
  if (reason === "signed-out") {
    return {
      variant: "info",
      title: "Signed out",
      body: "You have been signed out of the admin console.",
    };
  }

  switch (error) {
    case "AccessDenied":
      return {
        variant: "destructive",
        title: "Sign-in refused",
        body: "Your Keycloak account either carries no admin role, or completed sign-in without a second factor. Both are required for this console. Enrol a TOTP authenticator in Keycloak, and ask a super admin to confirm your role assignment.",
      };
    case "Configuration":
      return {
        variant: "destructive",
        title: "Authentication is misconfigured",
        body: "The console could not reach Keycloak with the credentials it has. This is a deployment problem, not an account problem — report it to whoever operates the console.",
      };
    case "Verification":
      return {
        variant: "warning",
        title: "Sign-in link is no longer valid",
        body: "Start again from this page.",
      };
    default:
      return error
        ? {
            variant: "destructive",
            title: "Sign-in failed",
            body: `Keycloak reported: ${error}.`,
          }
        : null;
  }
}
