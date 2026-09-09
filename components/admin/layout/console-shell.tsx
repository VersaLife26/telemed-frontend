"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, Menu, X } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { Badge } from "@/components/admin/ui/badge";
import { SessionGuard } from "@/components/admin/session/session-guard";
import { SessionCountdownBadge } from "@/components/admin/session/session-countdown-badge";
import type { AdminRole } from "@/lib/admin/api/types";
import { clientEnv } from "@/lib/admin/env.client";
import { cn } from "@/lib/admin/utils";

import { NotificationBell } from "./notification-bell";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * The console frame: skip link, sidebar, header, main region.
 *
 * Accessibility notes that are load-bearing rather than decorative:
 *   - a skip link is the first focusable element, so keyboard users are not
 *     forced through nine nav items to reach a table;
 *   - the main region is `<main id="main-content" tabIndex={-1}>` so the skip
 *     link actually moves focus rather than only the viewport;
 *   - the mobile drawer is a real dialog with focus return, and Escape closes it.
 */
export function ConsoleShell({
  children,
  name,
  email,
  roles,
}: {
  children: React.ReactNode;
  name: string;
  email: string;
  roles: readonly AdminRole[];
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    drawerRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const isProduction = clientEnv.appEnv === "production";

  return (
    <SessionGuard>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <div className="flex min-h-dvh">
        {/* --- desktop sidebar ------------------------------------------- */}
        <aside className="hidden w-72 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
          <div className="sticky top-0 flex h-dvh flex-col">
            <BrandMark />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SidebarNav roles={roles} />
            </div>
            <EnvironmentFooter />
          </div>
        </aside>

        {/* --- mobile drawer --------------------------------------------- */}
        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              tabIndex={-1}
              className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar shadow-xl outline-none"
            >
              <div className="flex items-center justify-between">
                <BrandMark />
                <Button
                  variant="ghost"
                  size="icon"
                  className="mr-2"
                  onClick={() => {
                    setDrawerOpen(false);
                    menuButtonRef.current?.focus();
                  }}
                  aria-label="Close navigation"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <SidebarNav roles={roles} onNavigate={() => setDrawerOpen(false)} />
              </div>
              <EnvironmentFooter />
            </div>
          </div>
        ) : null}

        {/* --- content ---------------------------------------------------- */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
            >
              <Menu className="size-4" aria-hidden="true" />
            </Button>

            <div className="flex-1" />

            <SessionCountdownBadge />

            {!isProduction ? (
              <Badge
                variant="outline"
                className={cn("hidden uppercase sm:inline-flex")}
                title="Deployment environment"
              >
                {clientEnv.appEnv}
              </Badge>
            ) : null}

            <NotificationBell />
            <ThemeToggle />
            <UserMenu name={name} email={email} roles={roles} />
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8"
          >
            {children}
          </main>
        </div>
      </div>
    </SessionGuard>
  );
}

function BrandMark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 px-5 py-4 text-sidebar-foreground"
    >
      <Activity className="size-5 text-primary" aria-hidden="true" />
      <span className="text-sm font-semibold tracking-tight">Telemed Admin</span>
    </Link>
  );
}

function EnvironmentFooter() {
  return (
    <div className="border-t border-sidebar-border px-5 py-3 text-xs text-muted-foreground">
      <p>
        No clinical data is available in this console. Prescriptions, reports and
        consultation notes are blocked at the database by row-level security.
      </p>
    </div>
  );
}
