import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { assets } from "@/lib/consumer/assets";
import { AuthHeroPanel } from "./AuthHeroPanel";

export function AuthLayout({
  children,
  blurb,
  scroll = false,
}: {
  children: ReactNode;
  blurb?: string;
  scroll?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col gap-4 bg-white p-4 lg:flex-row lg:gap-4 lg:p-8">
      <AuthHeroPanel blurb={blurb} />
      <div
        className={`flex min-h-[600px] flex-1 flex-col lg:min-h-0 ${
          scroll ? "lg:overflow-y-auto" : ""
        }`}
      >
        <div
          className={`flex min-h-[600px] flex-1 flex-col gap-10 rounded-[var(--radius-auth)] bg-bg-gray px-8 py-12 max-lg:px-6 sm:px-[60px] lg:min-h-0 lg:px-[80px] xl:px-[100px] ${
            scroll ? "justify-start" : "justify-center"
          }`}
        >
          <div className="relative h-[98px] w-[93px] shrink-0">
            <Image src={assets.logo} alt="Versalife Health" fill className="object-contain" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthHeading({
  title,
  subtitle,
}: {
  title: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex w-full flex-col gap-4 sm:gap-6">
      <div className="text-h1 text-black">{title}</div>
      {subtitle ? <p className="text-body text-text-muted">{subtitle}</p> : null}
    </div>
  );
}

export function AuthFooterLink({
  text,
  linkText,
  href,
}: {
  text: string;
  linkText: string;
  href: string;
}) {
  return (
    <p className="w-full text-center text-body text-text-muted">
      {text}{" "}
      <Link href={href} className="text-primary">
        {linkText}
      </Link>
    </p>
  );
}
