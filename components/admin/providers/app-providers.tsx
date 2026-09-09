"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "next-auth";

import { TooltipProvider } from "@/components/admin/ui/tooltip";
import { Toaster } from "@/components/admin/ui/toaster";
import { ApiError } from "@/lib/admin/api/errors";

/**
 * Client-side providers.
 *
 * The QueryClient is created inside a `useState` initialiser rather than at
 * module scope: a module-level client is shared across every request on the
 * server, which in an admin console means one operator's cached ledger page
 * can be served to the next.
 */
export function AppProviders({
  children,
  session,
  nonce,
}: {
  children: React.ReactNode;
  session: Session | null;
  nonce?: string;
}) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Admin data is operational, not archival. 30s keeps a queue screen
            // from re-fetching on every tab focus while still being fresh
            // enough that two admins do not work the same pending doctor.
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              if (error instanceof ApiError) {
                // Retrying a 403 or a 422 just produces the same answer more
                // slowly, and retrying a 401 races the session refresh.
                if (!error.retryable) return false;
              }
              return failureCount < 2;
            },
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
          },
          mutations: {
            // A mutation is a state change. Replaying it automatically is how
            // one force-cancel becomes two.
            retry: false,
          },
        },
      }),
  );

  return (
    <SessionProvider
      session={session}
      /*
       * Automatic polling is switched off deliberately.
       *
       * Auth.js re-issues the session cookie whenever /api/auth/session is
       * hit and `updateAge` has elapsed. A background poll therefore keeps
       * the session alive forever, which turns the 15-minute idle timeout the
       * V2 docs mandate into no timeout at all — an unattended laptop in an
       * open-plan office would stay signed in indefinitely.
       *
       * `components/session/session-guard.tsx` calls `update()` in response to
       * real user interaction instead, so the session is extended by an admin
       * doing work and by nothing else.
       */
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
