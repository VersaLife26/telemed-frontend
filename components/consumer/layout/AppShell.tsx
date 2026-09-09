import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { assets } from "@/lib/consumer/assets";

export function AppShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-screen flex-col gap-8 bg-white p-4 lg:p-8 ${className}`}>
      {children}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border-2 border-white bg-bg-gray p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function AppHeader({
  title,
  subtitle,
  nav,
}: {
  title?: ReactNode;
  subtitle?: string;
  nav?: { href: string; label: string; active?: boolean }[];
}) {
  return (
    <header className="flex w-full flex-col gap-6">
      <div className="flex w-full items-start justify-between gap-4">
        <div className="flex items-center gap-6 sm:gap-8">
          <Link href="/" className="relative h-16 w-[62px] shrink-0 sm:h-20 sm:w-[77px]">
            <Image src={assets.logoSmall} alt="Versalife Health" fill className="object-contain" />
          </Link>
          {title ? (
            <div className="flex flex-col gap-2">
              <div className="text-h2 text-black">{title}</div>
              {subtitle ? <p className="text-body text-text-muted">{subtitle}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/profile"
            className="relative size-[50px] overflow-hidden rounded-full border-2 border-primary"
          >
            <Image
              src={assets.avatarPlaceholder}
              alt="Profile"
              fill
              className="object-cover"
            />
          </Link>
        </div>
      </div>
      {nav?.length ? (
        <nav className="flex flex-wrap gap-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-[32px] px-5 py-2 text-body-sm ${
                item.active
                  ? "bg-primary text-white"
                  : "bg-bg-gray text-text-muted hover:text-black"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
