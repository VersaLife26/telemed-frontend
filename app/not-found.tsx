import Link from "next/link";

import { SURFACE } from "@/lib/consumer/surface";

/**
 * One 404 for three surfaces.
 *
 * It used to say "there is no admin console page at this address" on every
 * one of them, and to import the admin console's Button -- whose tokens do
 * not exist in the consumer stylesheet, so it rendered unstyled there.
 * No shared component now: the markup is small enough to branch outright.
 */
export default function NotFound() {
  if (SURFACE === "admin") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          There is no admin console page at this address. If you followed a link from a ticket,
          the page may have been renamed.
        </p>
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const home = SURFACE === "doctor" ? "/dashboard" : "/home";

  return (
    <div className="page-wash flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-eyebrow text-brand">404</p>
      <h1 className="text-h2 text-ink">Page not found</h1>
      <p className="max-w-prose text-body text-muted">
        There is nothing at this address. If you followed a link from an email, it may have
        expired.
      </p>
      <Link
        href={home}
        className="mt-2 inline-flex min-h-11 items-center rounded-pill bg-[image:var(--gradient-cta)] px-6 text-[0.9375rem] font-semibold text-on-brand shadow-brand transition-transform duration-[160ms] ease-out active:scale-[0.97]"
      >
        Back to VersaLife Health
      </Link>
    </div>
  );
}
