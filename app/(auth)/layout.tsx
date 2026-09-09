import type { Metadata } from "next";

import { SURFACE } from "@/lib/consumer/surface";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Frame for the pages an unauthenticated visitor can reach.
 *
 * The admin console frames its three (sign-in, IP-blocked, no-access) with a
 * centred card and a standing notice. The patient and doctor pages bring their
 * own AuthLayout with the product's hero panel, so this passes them through
 * rather than wrapping one frame in another.
 */
export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  if (SURFACE !== "admin") return <>{children}</>;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <main id="main-content" className="w-full max-w-md">
        {children}
      </main>
      <footer className="mt-8 max-w-md text-center text-xs text-muted-foreground">
        This console is restricted to allowlisted networks and requires two-factor
        authentication. Access is logged.
      </footer>
    </div>
  );
}
