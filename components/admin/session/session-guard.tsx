"use client";

import * as React from "react";
import { signOut, useSession } from "next-auth/react";
import { ShieldAlert } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Button } from "@/components/admin/ui/button";
import { Progress } from "@/components/admin/ui/progress";
import { clientEnv } from "@/lib/admin/env.client";
import { formatDuration, spellDuration } from "@/lib/admin/format";

/**
 * The 15-minute idle session, made visible.
 *
 * Behaviour:
 *   - Any real interaction (pointer, key, scroll, tab focus) resets the idle
 *     clock and, at most once a minute, rolls the server-side session so a
 *     working admin is never signed out mid-task.
 *   - With `sessionWarningSeconds` left, a modal appears with a live countdown.
 *     It is a modal on purpose: an admin halfway through a rejection reason
 *     needs to be interrupted, not to discover afterwards that the POST 401'd.
 *   - At zero, the console signs itself out and lands on /login?reason=idle.
 *   - The countdown itself does *not* count as activity, so leaving the dialog
 *     open does not extend the session.
 *
 * The server-side cookie `maxAge` is the real control — this is the humane
 * front end of it, not a substitute for it.
 */

interface CountdownState {
  /** Seconds until the idle deadline, or null when not near expiry. */
  secondsLeft: number | null;
  /** True while the warning dialog is showing. */
  warning: boolean;
  extend: () => void;
}

const CountdownContext = React.createContext<CountdownState>({
  secondsLeft: null,
  warning: false,
  extend: () => {},
});

/** Read by the header chip so the countdown is visible outside the dialog too. */
export function useSessionCountdown(): CountdownState {
  return React.useContext(CountdownContext);
}

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "focus",
] as const;

/** Roll the server session at most this often; matches `updateAge` in auth.config. */
const SERVER_REFRESH_INTERVAL_MS = 60_000;

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { status, update } = useSession();
  const idleMs = clientEnv.idleTimeoutSeconds * 1000;
  const warnMs = Math.min(clientEnv.sessionWarningSeconds * 1000, idleMs - 1000);

  const [deadline, setDeadline] = React.useState(() => Date.now() + idleMs);
  const [now, setNow] = React.useState(() => Date.now());
  // Initialised to 0 rather than Date.now(): reading the clock during render
  // is impure, and the only thing this ref gates is "have we rolled the server
  // session in the last minute", for which 0 means "not yet" and is correct.
  const lastServerRefresh = React.useRef(0);
  const signedOut = React.useRef(false);
  const stayButtonRef = React.useRef<HTMLButtonElement>(null);

  const authenticated = status === "authenticated";

  const registerActivity = React.useCallback(() => {
    const at = Date.now();
    setDeadline(at + idleMs);
    if (at - lastServerRefresh.current >= SERVER_REFRESH_INTERVAL_MS) {
      lastServerRefresh.current = at;
      // Fire and forget: a failed refresh will surface as the session going
      // unauthenticated, which the effect below already handles.
      void update();
    }
  }, [idleMs, update]);

  // --- activity listeners ---------------------------------------------------
  React.useEffect(() => {
    if (!authenticated) return;
    const handler = () => registerActivity();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handler, { passive: true });
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") registerActivity();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, handler);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authenticated, registerActivity]);

  // --- tick -----------------------------------------------------------------
  React.useEffect(() => {
    if (!authenticated) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [authenticated]);

  const remainingMs = deadline - now;
  const warning = authenticated && remainingMs <= warnMs;

  // --- expiry ---------------------------------------------------------------
  React.useEffect(() => {
    if (!authenticated || signedOut.current) return;
    if (remainingMs > 0) return;
    signedOut.current = true;
    void signOut({ redirectTo: "/login?reason=idle" });
  }, [authenticated, remainingMs]);

  const secondsLeft = authenticated ? Math.max(0, Math.ceil(remainingMs / 1000)) : null;

  const value = React.useMemo<CountdownState>(
    () => ({
      secondsLeft: warning ? secondsLeft : null,
      warning,
      extend: registerActivity,
    }),
    [warning, secondsLeft, registerActivity],
  );

  const warnSeconds = Math.max(1, Math.round(warnMs / 1000));
  const progress = secondsLeft === null ? 0 : (secondsLeft / warnSeconds) * 100;

  return (
    <CountdownContext.Provider value={value}>
      {children}

      <Dialog open={warning}>
        <DialogContent
          className="max-w-md"
          // Escape and outside-clicks would count as "still here" without the
          // admin having decided anything. Both are ignored; the two buttons
          // are the only exits.
          // Focus the safe action rather than the destructive one when the
          // dialog opens. Done through Radix's open-autofocus hook instead of
          // an `autoFocus` prop, which jsx-a11y rightly refuses in general —
          // the difference is that this focus move happens only when a modal
          // takes over the page, which is exactly when it is correct.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            stayButtonRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-warning" aria-hidden="true" />
              Your session is about to end
            </DialogTitle>
            <DialogDescription>
              Admin sessions end after {Math.round(clientEnv.idleTimeoutSeconds / 60)} minutes
              of inactivity. Unsaved changes on this page will be lost.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p
              className="text-center font-mono text-4xl tabular-nums"
              // The visual timer is decorative for assistive tech; the live
              // region below announces at a human cadence instead of once a
              // second, which would be unusable.
              aria-hidden="true"
            >
              {formatDuration(secondsLeft ?? 0)}
            </p>
            <Progress value={progress} aria-hidden="true" />
            <p aria-live="assertive" aria-atomic="true" className="sr-only">
              {secondsLeft !== null && secondsLeft % 15 === 0
                ? `Session ends in ${spellDuration(secondsLeft)}.`
                : ""}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                signedOut.current = true;
                void signOut({ redirectTo: "/login?reason=signed-out" });
              }}
            >
              Sign out now
            </Button>
            <Button ref={stayButtonRef} onClick={registerActivity}>
              Stay signed in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CountdownContext.Provider>
  );
}
