import type { Metadata } from "next";
import { ShieldOff } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { IpAllowlistWatcher } from "@/components/admin/security/ip-allowlist-watcher";

export const metadata: Metadata = { title: "Network not allowlisted" };

/**
 * Shown when the API gateway refuses this network address.
 *
 * This is a different failure from "you lack permission", and conflating the
 * two costs real time: an ops engineer whose VPN silently dropped will spend
 * ten minutes checking their Keycloak roles if the console tells them
 * "insufficient permissions".
 *
 * The gateway cannot currently distinguish the two in its response — both
 * `IPAllowlist` and `RequireRole` answer with `httpx.ErrForbidden` — so the
 * console distinguishes them itself, by exploiting the fact that `IPAllowlist`
 * runs *before* `RequireAuth` on admin routes. See `lib/api/gateway.ts`.
 */
export default function IpBlockedPage() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-destructive/10">
          <ShieldOff className="size-6 text-destructive" aria-hidden="true" />
        </div>
        <CardTitle className="text-xl">This network is not allowlisted</CardTitle>
        <CardDescription>
          The API gateway refused the request before it looked at who you are.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          The admin console is reachable only from the office network and the
          corporate VPN. Your current address is not on that list, so no admin
          data can be loaded — including the sign-in check.
        </p>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="mb-2 font-medium">What to try, in order</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Connect to the corporate VPN and wait for it to report connected.</li>
            <li>
              If you are in the office, confirm you are on the internal SSID rather
              than the guest network.
            </li>
            <li>
              If you are working from a new location, a super admin has to add your
              address range to the gateway allowlist before you can reach the console.
            </li>
          </ol>
        </div>

        <IpAllowlistWatcher />
      </CardContent>
    </Card>
  );
}
