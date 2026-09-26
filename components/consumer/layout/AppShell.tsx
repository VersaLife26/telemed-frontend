"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { browserApi } from "@/lib/consumer/api/client";
import type { DoctorProfile } from "@/lib/consumer/api/types";
import { profilePhotoSrc } from "@/lib/consumer/features/profile";
import { Avatar } from "@/components/consumer/ui/Avatar";
import { NavBar, type NavItem } from "@/components/consumer/ui/NavBar";

export function AppShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-[calc(var(--nav-h)+2rem)] md:px-8 ${className}`}>
      {children}
    </div>
  );
}

function useDoctorAccount() {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    browserApi<DoctorProfile>("/doctors/me")
      .then((me) => {
        if (!cancelled) setDoctor(me);
      })
      .catch(() => {
        if (!cancelled) setDoctor(null);
      });

    function onUpdated(event: Event) {
      setDoctor((event as CustomEvent<DoctorProfile>).detail ?? null);
    }
    window.addEventListener("telemed:doctor-profile-updated", onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("telemed:doctor-profile-updated", onUpdated);
    };
  }, []);

  return doctor;
}

/**
 * Doctor-surface header. Same slim top bar as the patient surface -- the two
 * used to carry different chrome, which is how they drifted. Page titles live
 * in each page's PageHero, so `title` only names the avatar.
 */
export function AppHeader({
  title,
  pathname = "",
  nav = [],
}: {
  title?: string;
  pathname?: string;
  nav?: ReadonlyArray<NavItem>;
}) {
  const doctor = useDoctorAccount();

  return (
    <NavBar
      homeHref="/dashboard"
      pathname={pathname}
      items={nav}
      trailing={
        <Link
          href="/profile"
          aria-label="Profile"
          className="flex min-h-10 items-center rounded-pill p-0.5 transition-transform duration-[160ms] ease-out active:scale-[0.96]"
        >
          <Avatar
            src={profilePhotoSrc(doctor?.photoUrl)}
            name={doctor?.displayName || title || null}
            size={32}
            ring
            className="ring-brand/30"
          />
        </Link>
      }
    />
  );
}

