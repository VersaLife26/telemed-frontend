"use client";

import { usePathname } from "next/navigation";

import { AppHeader, AppShell } from "@/components/consumer/layout/AppShell";
import { PatientBottomNav, PatientHeader } from "@/components/consumer/layout/PatientChrome";
import { SURFACE } from "@/lib/consumer/surface";

const DOCTOR_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/queue", label: "Queue" },
  { href: "/availability", label: "Availability" },
  { href: "/earnings", label: "Earnings" },
  { href: "/profile", label: "Profile" },
];

export default function ConsumerShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (SURFACE === "patient") {
    return (
      <div className="flex min-h-dvh flex-col bg-linen text-ink">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <PatientHeader />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">
          {children}
        </main>
        <PatientBottomNav />
      </div>
    );
  }

  const title =
    DOCTOR_NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.label ||
    "VersaLife";

  return (
    <AppShell>
      <AppHeader
        title={title}
        subtitle="VersaLife Telemedicine"
        nav={DOCTOR_NAV.map((n) => ({
          ...n,
          active: pathname === n.href || pathname.startsWith(`${n.href}/`),
        }))}
      />
      {children}
    </AppShell>
  );
}
