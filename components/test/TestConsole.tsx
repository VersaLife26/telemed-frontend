"use client";

import { useEffect, useState } from "react";
import { OutboxPanel } from "@/components/test/OutboxPanel";
import { InstantMeetingPanel } from "@/components/test/InstantMeetingPanel";

type Tab = "meeting" | "outbox";

/**
 * The developer test console.
 *
 * Deliberately not built from the consumer design system. It is a tool, not a
 * product surface, and making it look like the patient app invites the one
 * mistake that actually matters here -- somebody seeing a screenshot of it and
 * assuming it is a screen real users can reach.
 */
export function TestConsole() {
  const [tab, setTab] = useState<Tab>("meeting");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "outbox") setTab("outbox");
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Test console
        </h1>
        <p className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <strong>Developer surface.</strong> The inbox below needs no login and shows plaintext OTP
          codes for any number that has been sent one. It works only while the API&apos;s capture
          and instant-meeting switches are on and this server has{" "}
          <code className="font-mono">TEST_SECRET</code> set; otherwise the API answers 404 or 401.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-neutral-300 dark:border-neutral-700">
        <TabButton active={tab === "meeting"} onClick={() => setTab("meeting")}>
          Instant meeting
        </TabButton>
        <TabButton active={tab === "outbox"} onClick={() => setTab("outbox")}>
          OTP &amp; email
        </TabButton>
      </nav>

      {tab === "meeting" ? <InstantMeetingPanel /> : <OutboxPanel />}
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
