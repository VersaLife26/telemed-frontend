"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileText, MousePointer2, X } from "lucide-react";

import { FloatingCall } from "@/components/consumer/call/floating-call";
import { StreamVideo } from "@/components/consumer/call/stream-video";
import { afterEndPath, isConsultTerminal } from "@/lib/consumer/features/consult";
import {
  useConsultation,
  type ConsultationControls,
  type ConsultationRole,
} from "@/lib/consumer/features/use-consultation";
import { SURFACE } from "@/lib/consumer/surface";

type CallContextValue = {
  call: ConsultationControls;
  role: ConsultationRole;
  activeId: string | null;
  start: (appointmentId: string) => void;
  /** Leaves the call (if connected) and forgets it. */
  stop: () => void;
  registerScreen: () => () => void;
  pipSupported: boolean;
  popOut: () => Promise<void>;
};

const CallContext = createContext<CallContextValue | null>(null);

export const CALL_EXPAND_EVENT = "telemed:call-expand";

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

export function useOptionalCall(): CallContextValue | null {
  return useContext(CallContext);
}

/** Marks a full-size call view as visible; the floating tile hides while any is. */
export function useCallScreen(visible = true) {
  const register = useContext(CallContext)?.registerScreen;
  useEffect(() => {
    if (!visible || !register) return;
    return register();
  }, [visible, register]);
}

export function callScreenHref(role: ConsultationRole, appointmentId: string): string {
  return role === "doctor"
    ? `/workspace?call=${encodeURIComponent(appointmentId)}`
    : `/appointments/${appointmentId}/call`;
}

/**
 * Owns the one live consultation for the whole signed-in app, so moving
 * between pages (the vault, the doctor's dashboard) does not hang up. Call
 * screens borrow `call` from here instead of creating their own connection.
 */
export function CallProvider({ children }: { children: React.ReactNode }) {
  const role: ConsultationRole = SURFACE === "doctor" ? "doctor" : "patient";
  const router = useRouter();
  const pathname = usePathname();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [screens, setScreens] = useState(0);
  const [ended, setEnded] = useState<string | null>(null);
  const [fileToast, setFileToast] = useState<{ name: string; at: number } | null>(null);
  const pipRef = useRef<HTMLVideoElement>(null);
  const call = useConsultation(activeId, role);

  const start = useCallback((id: string) => {
    setEnded(null);
    setActiveId(id);
  }, []);

  const leave = call.leave;
  const stop = useCallback(() => {
    leave();
    setActiveId(null);
    if (typeof document !== "undefined" && document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => undefined);
    }
  }, [leave]);

  const registerScreen = useCallback(() => {
    setScreens((n) => n + 1);
    return () => setScreens((n) => n - 1);
  }, []);

  const [pipSupported, setPipSupported] = useState(false);
  useEffect(() => {
    setPipSupported(typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled);
  }, []);

  const popOut = useCallback(async () => {
    const el = pipRef.current;
    if (!el) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture().catch(() => undefined);
      return;
    }
    await el.requestPictureInPicture().catch(() => undefined);
  }, []);

  // Chromium pops the call into a PiP window on its own when the tab is
  // hidden, as long as a handler is registered for this action.
  useEffect(() => {
    if (!call.live || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession as MediaSession & {
      setActionHandler(action: string, handler: (() => void) | null): void;
    };
    try {
      session.setActionHandler("enterpictureinpicture", () => void pipRef.current?.requestPictureInPicture());
    } catch {
      return;
    }
    return () => {
      try {
        session.setActionHandler("enterpictureinpicture", null);
      } catch {
        /* unsupported action */
      }
    };
  }, [call.live]);

  useEffect(() => {
    if (!activeId) return;
    const onHide = () => leave();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [activeId, leave]);

  // A call screen handles the end itself (redirect to summary or notes). When
  // the consultation ends while the person is elsewhere, say so in place.
  useEffect(() => {
    if (!activeId || !isConsultTerminal(call.status) || screens > 0) return;
    setEnded(activeId);
    stop();
  }, [activeId, call.status, screens, stop]);

  useEffect(() => {
    if (!call.sharedFile) return;
    setFileToast(call.sharedFile);
    const timer = window.setTimeout(() => setFileToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [call.sharedFile]);

  const expand = useCallback(() => {
    if (!activeId) return;
    if (role === "doctor" && pathname === "/workspace") {
      window.dispatchEvent(new CustomEvent(CALL_EXPAND_EVENT));
      return;
    }
    router.push(callScreenHref(role, activeId));
  }, [activeId, pathname, role, router]);

  const value = useMemo<CallContextValue>(
    () => ({ call, role, activeId, start, stop, registerScreen, pipSupported, popOut }),
    [call, role, activeId, start, stop, registerScreen, pipSupported, popOut],
  );

  const inCall = Boolean(activeId && (call.live || call.waiting || call.connecting));
  const showFloating = inCall && screens === 0;
  const counterpart = call.counterpartName || (role === "doctor" ? "The patient" : "Your doctor");

  return (
    <CallContext.Provider value={value}>
      {children}
      {activeId && call.live ? (
        <StreamVideo
          stream={call.remoteStream}
          videoRef={pipRef}
          muted
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none fixed bottom-0 right-0 size-px opacity-0"
        />
      ) : null}
      {showFloating ? (
        <FloatingCall
          call={call}
          onExpand={expand}
          onHangUp={stop}
          pipSupported={pipSupported}
          onPopOut={() => void popOut()}
        />
      ) : null}
      <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[80] flex flex-col items-center gap-2 px-4">
        {activeId && call.pointing ? (
          <div
            role="status"
            className="call-toast glass-dark pointer-events-auto flex items-center gap-3 rounded-pill py-1.5 pl-4 pr-1.5 text-body-sm text-white shadow-lg"
          >
            <MousePointer2 aria-hidden="true" className="size-4 shrink-0 text-brand-tint" />
            <span>
              Pointer on<span className="max-sm:hidden"> · Esc to stop</span>
            </span>
            <button
              type="button"
              onClick={call.togglePointing}
              className="min-h-9 rounded-pill bg-white px-4 font-semibold text-ink transition-[scale] duration-[140ms] ease-out active:scale-[0.97]"
            >
              Stop
            </button>
          </div>
        ) : null}
        {fileToast ? (
          <CallToast key={fileToast.at} onDismiss={() => setFileToast(null)}>
            <FileText aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 truncate">
              {counterpart} added <span className="font-semibold">{fileToast.name}</span>
            </span>
            {role === "patient" && pathname !== "/vault" && screens === 0 ? (
              <Link href="/vault" className="shrink-0 font-semibold underline underline-offset-4">
                Open
              </Link>
            ) : null}
          </CallToast>
        ) : null}
        {ended ? (
          <CallToast onDismiss={() => setEnded(null)}>
            <span>The consultation has ended.</span>
            <Link
              href={afterEndPath(role, ended)}
              onClick={() => setEnded(null)}
              className="shrink-0 font-semibold underline underline-offset-4"
            >
              {role === "doctor" ? "Write notes" : "View summary"}
            </Link>
          </CallToast>
        ) : null}
      </div>
    </CallContext.Provider>
  );
}

function CallToast({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="call-toast glass-dark pointer-events-auto flex max-w-md items-center gap-3 rounded-pill py-2 pl-4 pr-2 text-body-sm text-white shadow-lg"
    >
      {children}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="flex size-8 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-[140ms] ease-out active:scale-[0.94] can-hover:hover:bg-white/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
