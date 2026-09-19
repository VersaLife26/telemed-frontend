"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { assets } from "@/lib/consumer/assets";
import { cx } from "@/lib/consumer/cx";

export type NavItem = { href: string; label: string };

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The slim top bar both surfaces' headers are built from.
 *
 * Transparent while it sits over the page hero, so the hero reads as the top
 * of the page; frosted (`.top-bar[data-scrolled]`) once content scrolls under
 * it, where a transparent bar would put links on top of body text.
 */
export function NavBar({
  homeHref,
  items,
  pathname,
  trailing,
  className,
}: {
  homeHref: string;
  items: ReadonlyArray<NavItem>;
  pathname: string;
  trailing?: ReactNode;
  className?: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled ? "" : undefined}
      className={cx("top-bar fixed inset-x-0 top-0 z-40 h-[var(--nav-h)]", className)}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-6 px-4 md:px-8">
        <Link
          href={homeHref}
          className="flex shrink-0 items-center gap-2 transition-transform duration-[160ms] ease-out active:scale-[0.96]"
        >
          <span className="relative size-8">
            <Image src={assets.logoSmall} alt="" fill className="object-contain" priority />
          </span>
          <span className="font-display text-[0.9375rem] font-semibold tracking-tight text-ink">
            VersaLife Health
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 md:flex">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative inline-flex min-h-10 items-center px-3 text-label",
                  "transition-colors duration-[160ms] ease-out",
                  "after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-brand",
                  "after:origin-left after:transition-transform after:duration-[220ms] after:ease-out",
                  active
                    ? "text-ink after:scale-x-100"
                    : "text-muted after:scale-x-0 can-hover:hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {trailing}
      </div>
    </header>
  );
}
