"use client";

import { usePathname } from "next/navigation";

import { AppHeader, AppShell } from "@/components/consumer/layout/AppShell";
import { PatientBottomNav, PatientHeader } from "@/components/consumer/layout/PatientChrome";
import { isActivePath } from "@/components/consumer/ui/NavBar";
import { SURFACE } from "@/lib/consumer/surface";

const DOCTOR_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/queue", label: "Queue" },
  { href: "/availability", label: "Availability" },
  { href: "/earnings", label: "Earnings" },
  { href: "/profile", label: "Profile" },
] as const;

/**
 * The signed-in frame for both consumer surfaces.
 *
 * `page-wash` is not decoration: the chrome and several cards are frosted
 * glass, and glass over flat white has nothing to refract. The wash is what
 * makes the material read as material.
 */
export default function ConsumerShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (SURFACE === "patient") {
    return (
      <div className="page-wash flex min-h-dvh flex-col text-ink">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <PatientHeader />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-8 md:px-8 md:pb-12">
          {children}
        </main>
        <PatientBottomNav />
      </div>
    );
  }

  const title = DOCTOR_NAV.find((n) => isActivePath(pathname, n.href))?.label || "VersaLife Health";

  return (
    <div className="page-wash flex min-h-dvh flex-col text-ink">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <AppHeader
        title={title}
        subtitle="VersaLife Health"
        pathname={pathname}
        nav={DOCTOR_NAV}
      />
      <main id="main" className="flex-1">
        <AppShell>{children}</AppShell>
      </main>
    </div>
  );
}
