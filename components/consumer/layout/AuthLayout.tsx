import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { assets } from "@/lib/consumer/assets";
import { cx } from "@/lib/consumer/cx";
import { Reveal } from "@/components/consumer/ui/Reveal";

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
    <div className="page-wash flex min-h-dvh flex-col gap-4 p-4 lg:flex-row lg:p-6">
      <AuthHeroPanel blurb={blurb} />

      <div className={cx("flex min-h-[600px] flex-1 flex-col lg:min-h-0", scroll && "lg:overflow-y-auto")}>
        <div
          className={cx(
            "flex min-h-[600px] flex-1 flex-col gap-8 rounded-xl bg-surface px-6 py-10 shadow-md sm:px-12 lg:min-h-0 lg:px-16 xl:px-20",
            scroll ? "justify-start" : "justify-center",
          )}
        >
          <div className="relative h-14 w-14 shrink-0">
            <Image src={assets.logo} alt="VersaLife Health" fill className="object-contain" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: ReactNode; subtitle?: string }) {
  return (
    <Reveal className="flex w-full flex-col gap-3">
      <h1 className="text-h1 text-ink">{title}</h1>
      {subtitle ? <p className="text-body-lg text-muted">{subtitle}</p> : null}
    </Reveal>
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
    <p className="w-full text-center text-body text-muted">
      {text}{" "}
      <Link
        href={href}
        className="font-semibold text-brand underline-offset-4 can-hover:hover:underline"
      >
        {linkText}
      </Link>
    </p>
  );
}
