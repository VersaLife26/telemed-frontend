"use client";

import {
  CalendarDays,
  CalendarRange,
  Clock,
  LayoutDashboard,
  ListOrdered,
  MonitorPlay,
  UserRound,
  Wallet,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { AppHeader, AppShell } from "@/components/consumer/layout/AppShell";
import { PATIENT_NAV, PatientHeader } from "@/components/consumer/layout/PatientChrome";
import { isActivePath } from "@/components/consumer/ui/NavBar";
import { TabBar } from "@/components/consumer/ui/TabBar";
import { SURFACE } from "@/lib/consumer/surface";

const DOCTOR_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspace", label: "Workspace", icon: MonitorPlay },
  { href: "/appointments", label: "Visits", icon: CalendarDays },
  { href: "/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/queue", label: "Queue", icon: ListOrdered },
  { href: "/availability", label: "Availability", icon: Clock },
  { href: "/earnings", label: "Earnings", icon: Wallet },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

const DOCTOR_TABS = ["/dashboard", "/appointments", "/queue", "/calendar"];
const DOCTOR_TAB_ITEMS = DOCTOR_NAV.filter((n) => DOCTOR_TABS.includes(n.href));
const DOCTOR_MORE_ITEMS = DOCTOR_NAV.filter((n) => !DOCTOR_TABS.includes(n.href));

/**
 * Re-plays a short rise on the content container whenever the route changes.
 * WAAPI on the existing node rather than a `key={pathname}`, because a key
 * would remount every nested layout and drop its state. Skipped on first
 * paint: the server-rendered page is already on screen.
 */
function usePageEnter(pathname: string) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const node = ref.current;
    if (!node || typeof node.animate !== "function") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.animate(
      reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translateY(6px)" },
            { opacity: 1, transform: "none" },
          ],
      { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
  }, [pathname]);

  return ref;
}

/**
 * The signed-in frame for both consumer surfaces.
 *
 * `page-wash` is not decoration: the chrome and several cards are frosted
 * glass, and glass over flat white has nothing to refract. The wash is what
 * makes the material read as material.
 */
export default function ConsumerShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const enterRef = usePageEnter(pathname);

  if (SURFACE === "doctor" && pathname.startsWith("/workspace")) {
    return <>{children}</>;
  }

  if (SURFACE === "patient" && /\/appointments\/[^/]+\/call\/?$/.test(pathname)) {
    return <>{children}</>;
  }

  if (SURFACE === "patient") {
    return (
      <div className="page-wash flex min-h-dvh flex-col overflow-x-clip text-ink">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <PatientHeader />
        <main
          id="main"
          className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-[calc(var(--nav-h)+2rem)] md:px-8 md:pb-12"
        >
          <div ref={enterRef}>{children}</div>
        </main>
        <TabBar items={PATIENT_NAV} pathname={pathname} />
      </div>
    );
  }

  const title = DOCTOR_NAV.find((n) => isActivePath(pathname, n.href))?.label || "VersaLife Health";

  return (
    <div className="page-wash flex min-h-dvh flex-col overflow-x-clip text-ink">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <AppHeader title={title} pathname={pathname} nav={DOCTOR_NAV} />
      <main id="main" className="flex-1 pb-20 md:pb-0">
        <AppShell>
          <div ref={enterRef}>{children}</div>
        </AppShell>
      </main>
      <TabBar items={DOCTOR_TAB_ITEMS} overflow={DOCTOR_MORE_ITEMS} pathname={pathname} />
    </div>
  );
}
