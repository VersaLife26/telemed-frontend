import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "@/components/consumer/ui/Avatar";
import { NavBar, type NavItem } from "@/components/consumer/ui/NavBar";

export function AppShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-[calc(var(--nav-h)+2rem)] md:px-8 ${className}`}>
      {children}
    </div>
  );
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
          <Avatar name={title ?? null} size={32} ring className="ring-brand/30" />
        </Link>
      }
    />
  );
}
