import type { ReactNode } from "react";

import { cx } from "@/lib/consumer/cx";

import { Button, ButtonLink } from "./Button";
import { Card } from "./Card";

export function EmptyState({
  title,
  body,
  icon,
  action,
  tone = "light",
  className,
}: {
  title: string;
  body: string;
  icon?: ReactNode;
  action?: { href: string; label: string } | { onClick: () => void; label: string };
  tone?: "light" | "dark";
  className?: string;
}) {
  let control: ReactNode = null;
  if (action && "href" in action) {
    control = (
      <ButtonLink href={action.href} variant="secondary">
        {action.label}
      </ButtonLink>
    );
  } else if (action && "onClick" in action) {
    control = (
      <Button variant="secondary" onClick={action.onClick}>
        {action.label}
      </Button>
    );
  }

  if (tone === "dark") {
    return (
      <div className={cx("flex flex-col items-start gap-3 p-6", className)}>
        {icon ? (
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white"
          >
            {icon}
          </span>
        ) : null}
        <h2 className="text-h5 text-white">{title}</h2>
        <p className="max-w-prose text-body text-white/70">{body}</p>
        {control}
      </div>
    );
  }

  return (
    <Card variant="tint" className={cx("flex flex-col items-start gap-3", className)}>
      {icon ? (
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-surface text-brand shadow-sm"
        >
          {icon}
        </span>
      ) : null}
      <h2 className="text-h5 text-ink">{title}</h2>
      <p className="max-w-prose text-body text-muted">{body}</p>
      {control}
    </Card>
  );
}
