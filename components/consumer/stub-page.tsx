import Link from "next/link";

export function StubPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Phase 1 stub — wire to API gateway in a later phase.
      </p>
      {children}
    </div>
  );
}

export function TextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
    >
      {children}
    </Link>
  );
}
