import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string } | { onClick: () => void; label: string };
}) {
  let control: ReactNode = null;
  if (action && "href" in action) {
    control = <ButtonLink href={action.href}>{action.label}</ButtonLink>;
  } else if (action && "onClick" in action) {
    control = (
      <Button type="button" onClick={action.onClick}>
        {action.label}
      </Button>
    );
  }

  return (
    <Card className="flex flex-col items-start gap-3">
      <h2 className="text-h5 text-ink">{title}</h2>
      <p className="max-w-prose text-body text-text-muted">{body}</p>
      {control}
    </Card>
  );
}
