"use client";

import { usePathname } from "next/navigation";

import { AppHeader, AppShell } from "@/components/consumer/layout/AppShell";
import { SURFACE } from "@/lib/consumer/surface";

const PATIENT_NAV = [
  { href: "/home", label: "Home" },
  { href: "/doctors", label: "Doctors" },
  { href: "/appointments", label: "Appointments" },
  { href: "/vault", label: "Vault" },
  { href: "/profile", label: "Profile" },
];

const DOCTOR_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/queue", label: "Queue" },
  { href: "/availability", label: "Availability" },
  { href: "/earnings", label: "Earnings" },
  { href: "/profile", label: "Profile" },
];

export default function ConsumerShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const nav = SURFACE === "doctor" ? DOCTOR_NAV : PATIENT_NAV;
  const title =
    nav.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.label || "VersaLife";

  return (
    <AppShell>
      <AppHeader
        title={title}
        subtitle="VersaLife Telemedicine"
        nav={nav.map((n) => ({
          ...n,
          active: pathname === n.href || pathname.startsWith(`${n.href}/`),
        }))}
      />
      {children}
    </AppShell>
  );
}
