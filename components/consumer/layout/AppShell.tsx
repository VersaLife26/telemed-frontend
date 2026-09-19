import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "@/components/consumer/ui/Avatar";
import { NavBar, type NavItem } from "@/components/consumer/ui/NavBar";

export function AppShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-6 md:px-8 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Doctor-surface header. Same floating glass pill as the patient surface --
 * the two used to carry different chrome, which is how they drifted.
 */
export function AppHeader({
  title,
  subtitle,
  pathname = "",
  nav = [],
}: {
  title?: ReactNode;
  subtitle?: string;
  pathname?: string;
  nav?: ReadonlyArray<NavItem>;
}) {
  return (
    <>
      <NavBar
        homeHref="/dashboard"
        pathname={pathname}
        items={nav}
        trailing={
          <Link
            href="/profile"
            aria-label="Profile"
            className="flex min-h-11 items-center rounded-pill p-0.5 transition-transform duration-[160ms] ease-out active:scale-[0.96]"
          >
            <Avatar name={title ? String(title) : null} size={40} ring className="ring-brand/30" />
          </Link>
        }
      />
      {title ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 md:px-8">
          <h1 className="text-h2 text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-body text-muted">{subtitle}</p> : null}
        </div>
      ) : null}
    </>
  );
}
