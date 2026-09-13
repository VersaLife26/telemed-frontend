"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  FolderClosed,
  House,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { cx } from "@/lib/consumer/cx";
import { assets } from "@/lib/consumer/assets";

export const PATIENT_NAV = [
  { href: "/home", label: "Home", icon: House },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/vault", label: "Vault", icon: FolderClosed },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PatientHeader() {
  const pathname = usePathname();

  return (
    <header className="chrome-blur sticky top-0 z-30 border-b border-border/80 bg-paper/75 backdrop-blur-[20px] backdrop-saturate-150">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/home" className="relative h-12 w-[48px] shrink-0 sm:h-14 sm:w-[54px]">
          <Image src={assets.logoSmall} alt="VersaLife Health" fill className="object-contain" />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {PATIENT_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-11 items-center rounded-full px-4 text-body-sm font-medium transition-colors duration-[200ms] ease-[var(--ease-out)]",
                  active ? "bg-primary text-white" : "text-text-muted hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/profile"
          aria-label="Profile"
          className="relative size-11 overflow-hidden rounded-full border-2 border-primary"
        >
          <Image src={assets.avatarPlaceholder} alt="" fill className="object-cover" />
        </Link>
      </div>
    </header>
  );
}

export function PatientBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="chrome-blur fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-paper/90 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-[20px] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {PATIENT_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium",
                  active ? "text-primary" : "text-text-muted",
                )}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
