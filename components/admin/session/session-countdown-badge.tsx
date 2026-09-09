"use client";

import { TimerReset } from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
import { formatDuration } from "@/lib/admin/format";
import { useSessionCountdown } from "./session-guard";

/**
 * Header chip mirroring the modal countdown, so an admin who dismissed the
 * dialog by choosing "Stay signed in" and then went idle again sees the clock
 * before the modal reappears.
 */
export function SessionCountdownBadge() {
  const { secondsLeft } = useSessionCountdown();
  if (secondsLeft === null) return null;

  return (
    <Badge variant="warning" className="gap-1.5 tabular-nums">
      <TimerReset className="size-3.5" aria-hidden="true" />
      <span className="sr-only">Session ends in </span>
      {formatDuration(secondsLeft)}
    </Badge>
  );
}
