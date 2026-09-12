"use client";

import * as React from "react";
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
 *     clock, so a working admin is never signed out mid-task.
 *   - With `sessionWarningSeconds` left, a modal appears with a live countdown.
 *     It is a modal on purpose: an admin halfway through a rejection reason
 *     needs to be interrupted, not to discover afterwards that the POST 401'd.
 *   - At zero, the browser is sent to Cloudflare Access's logout endpoint,
 *     which ends the Access session itself. Nothing local is cleared, because
 *     nothing local is the credential.
 *   - The countdown itself does *not* count as activity, so leaving the dialog
 *     open does not extend the session.
 *
 * READ THIS BEFORE TRUSTING IT. Under Auth.js the server-side cookie `maxAge`
 * was the real control and this was its humane front end. There is no such
 * cookie now: Cloudflare Access owns the session, and the Access application's
 * own session duration is the only server-side bound. This timer runs entirely
 * in the browser, so it is a usability control and a shoulder-surfing defence,
 * NOT something that survives a closed tab or a hostile client.
 *
 * The server-side equivalent is the Access application's session duration
 * (`cfa_session_duration` in playbooks/04-cloudflare.yml). Shorten that if the
 * idle window here is meant to be enforced rather than merely honoured.
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

/** Where an expired idle session lands. Ends the Access session, not a cookie. */
const ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const idleMs = clientEnv.idleTimeoutSeconds * 1000;
  const warnMs = Math.min(clientEnv.sessionWarningSeconds * 1000, idleMs - 1000);

  const [deadline, setDeadline] = React.useState(() => Date.now() + idleMs);
  const [now, setNow] = React.useState(() => Date.now());
  const signedOut = React.useRef(false);
  const stayButtonRef = React.useRef<HTMLButtonElement>(null);

  // Every render of this component is inside the console layout, which has
  // already established the caller passed Access and holds a role. There is
  // no "unauthenticated" client state to wait for any more.
  const authenticated = true;

  const registerActivity = React.useCallback(() => {
    setDeadline(Date.now() + idleMs);
  }, [idleMs]);

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
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- /cdn-cgi/access/logout is a Cloudflare edge endpoint, not a Next.js route: it must be a full navigation, and useRouter().push() would try to resolve it client-side and 404.
    window.location.href = ACCESS_LOGOUT_PATH;
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
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- /cdn-cgi/access/logout is a Cloudflare edge endpoint, not a Next.js route: it must be a full navigation, and useRouter().push() would try to resolve it client-side and 404.
                window.location.href = ACCESS_LOGOUT_PATH;
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
