"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { assets } from "@/lib/consumer/assets";
import { cx } from "@/lib/consumer/cx";

export type NavItem = { href: string; label: string };

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The floating glass pill both surfaces' headers are built from.
 *
 * It is a translucent layer with the page scrolling under it rather than an
 * opaque strip that eats a fixed band of the viewport -- which is also why the
 * shell paints a gradient wash behind it. Over flat white there would be
 * nothing for the frosting to refract and the bar would read as a plain box.
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
  return (
    <header className={cx("sticky top-0 z-30 px-4 pt-3 md:px-8 md:pt-4", className)}>
      <div className="chrome-blur glass-panel mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-pill py-2 pl-4 pr-2 md:pl-6 md:pr-3">
        <Link
          href={homeHref}
          className="relative h-10 w-10 shrink-0 transition-transform duration-[160ms] ease-out active:scale-[0.94] sm:h-11 sm:w-11"
        >
          <Image
            src={assets.logoSmall}
            alt="VersaLife Health"
            fill
            className="object-contain"
            priority
          />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-10 items-center rounded-pill px-4 text-label",
                  "transition-[background-color,color] duration-[160ms] ease-out",
                  active
                    ? "bg-brand text-on-brand"
                    : "text-muted can-hover:hover:bg-surface/70 can-hover:hover:text-ink",
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
