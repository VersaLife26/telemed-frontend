"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  FolderClosed,
  House,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { browserApi } from "@/lib/consumer/api/client";
import type { TelemedUser } from "@/lib/consumer/api/types";
import { cx } from "@/lib/consumer/cx";
import { profilePhotoSrc } from "@/lib/consumer/features/profile";
import { Avatar } from "@/components/consumer/ui/Avatar";
import { NavBar, isActivePath } from "@/components/consumer/ui/NavBar";

export const PATIENT_NAV = [
  { href: "/home", label: "Home", icon: House },
  { href: "/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/vault", label: "Vault", icon: FolderClosed },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

/** The signed-in patient's own photo, kept live across profile edits. */
function useAccount() {
  const [account, setAccount] = useState<TelemedUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    browserApi<TelemedUser>("/users/me")
      .then((me) => {
        if (!cancelled) setAccount(me);
      })
      .catch(() => {
        if (!cancelled) setAccount(null);
      });

    // profile.ts dispatches this after a successful save, so the header does
    // not keep showing the old photo until the next full navigation.
    function onProfileUpdated(event: Event) {
      setAccount((event as CustomEvent<TelemedUser>).detail ?? null);
    }
    window.addEventListener("telemed:profile-updated", onProfileUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("telemed:profile-updated", onProfileUpdated);
    };
  }, []);

  return account;
}

export function PatientHeader() {
  const pathname = usePathname();
  const account = useAccount();

  return (
    <NavBar
      homeHref="/home"
      pathname={pathname}
      items={PATIENT_NAV}
      trailing={
        <Link
          href="/profile"
          aria-label="Profile"
          aria-current={isActivePath(pathname, "/profile") ? "page" : undefined}
          className="flex min-h-10 items-center rounded-pill p-0.5 transition-transform duration-[160ms] ease-out active:scale-[0.96]"
        >
          <Avatar
            src={profilePhotoSrc(account?.photo_url)}
            name={account?.name}
            size={32}
            ring
            className="ring-brand/30"
          />
        </Link>
      }
    />
  );
}

export function PatientBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="chrome-blur fixed inset-x-0 bottom-0 z-40 border-t border-white/50 bg-[var(--glass-bg-light)] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-[16px] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {PATIENT_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="group flex min-h-14 flex-col items-center justify-center gap-1 px-1"
              >
                <span
                  className={cx(
                    "flex h-7 w-12 items-center justify-center rounded-pill",
                    "transition-[background-color,color] duration-[160ms] ease-out",
                    active ? "bg-brand text-on-brand" : "text-muted",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                <span
                  className={cx(
                    "text-[11px] font-medium transition-colors duration-[160ms] ease-out",
                    active ? "text-brand" : "text-muted",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
