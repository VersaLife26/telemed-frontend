import { SURFACE } from "@/lib/consumer/surface";
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  ...(SURFACE === "doctor"
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/queue", label: "Queue" },
        { href: "/availability", label: "Availability" },
        { href: "/earnings", label: "Earnings" },
      ]
    : [
        { href: "/home", label: "Home" },
        { href: "/doctors", label: "Doctors" },
        { href: "/appointments", label: "Appointments" },
        { href: "/vault", label: "Vault" },
      ]),
  { href: "/profile", label: "Profile" },
] as const;

export function ShellNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href={SURFACE === "doctor" ? "/dashboard" : "/home"} className="text-lg font-semibold text-primary">
          {SURFACE === "doctor" ? "VersaLife Doctor" : "VersaLife Patient"}
        </Link>
        <nav className="flex flex-wrap gap-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
