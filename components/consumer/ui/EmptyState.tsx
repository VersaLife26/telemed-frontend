import type { ReactNode } from "react";

import { Button, ButtonLink } from "./Button";
import { Card } from "./Card";

export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body: string;
  icon?: ReactNode;
  action?: { href: string; label: string } | { onClick: () => void; label: string };
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

  return (
    <Card variant="tint" className="flex flex-col items-start gap-3">
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
