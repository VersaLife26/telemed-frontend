"use client";

import { useEffect, useState } from "react";
import { fetchStatus, type TestStatus } from "@/lib/test/api";
import { OutboxPanel } from "@/components/test/OutboxPanel";
import { WebRtcPanel } from "@/components/test/WebRtcPanel";

type Tab = "webrtc" | "outbox";

/**
 * The developer test console.
 *
 * Deliberately not built from the consumer design system. It is a tool, not a
 * product surface, and making it look like the patient app invites the one
 * mistake that actually matters here -- somebody seeing a screenshot of it and
 * assuming it is a screen real users can reach.
 */
export function TestConsole() {
  const [tab, setTab] = useState<Tab>("webrtc");
  const [status, setStatus] = useState<TestStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "outbox") setTab("outbox");

    fetchStatus()
      .then(setStatus)
      .catch((e: unknown) => {
        setError(
          e instanceof Error
            ? `${e.message} — is the backend running with TELEMED_TEST_MODE=true?`
            : String(e),
        );
      });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Test console
          </h1>
          {status ? (
            <span className="rounded bg-neutral-200 px-2 py-0.5 font-mono text-xs dark:bg-neutral-700">
              {status.env} · {status.version}
            </span>
          ) : null}
        </div>
        <p className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <strong>Unauthenticated developer surface.</strong> Everything here works without a login,
          and the outbox shows plaintext OTP codes for any number that has been sent one. It exists
          only while <code className="font-mono">TELEMED_TEST_MODE</code> is on, and a production{" "}
          <code className="font-mono">ENV</code> disables it regardless of that flag.
        </p>
        {error ? (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {error}
          </p>
        ) : null}
        {status && !status.turn_configured ? (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            No TURN server is configured. Calls will connect on a LAN and on most home connections,
            and will fail behind symmetric or carrier-grade NAT — which is how most Sri Lankan mobile
            users reach the internet. Set <code className="font-mono">ICE_TURN_URLS</code> before
            reading anything into a successful test here.
          </p>
        ) : null}
      </header>

      <nav className="flex gap-1 border-b border-neutral-300 dark:border-neutral-700">
        <TabButton active={tab === "webrtc"} onClick={() => setTab("webrtc")}>
          Video call
        </TabButton>
        <TabButton active={tab === "outbox"} onClick={() => setTab("outbox")}>
          OTP &amp; email
        </TabButton>
      </nav>

      {tab === "webrtc" ? <WebRtcPanel /> : <OutboxPanel />}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm ${
        active
          ? "border-blue-600 font-medium text-blue-700 dark:text-blue-400"
          : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}
