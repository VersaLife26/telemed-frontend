"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearOutbox,
  fetchOutbox,
  sendOtp,
  verifyOtp,
  type OutboxMessage,
} from "@/lib/test/api";

/**
 * Reads back everything the platform tried to send.
 *
 * In test mode the SMS and email providers are replaced by a capture that
 * records the rendered message and delivers nothing, so this is where an OTP
 * code and an email body actually become visible. Nothing here fabricates a
 * message: the OTP form below calls the real /auth/otp/send, so what appears
 * in the list went through the real validation, the real rate limiter and the
 * real template.
 */
export function OutboxPanel() {
  const [messages, setMessages] = useState<OutboxMessage[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [phone, setPhone] = useState("+94771234567");
  const [code, setCode] = useState("");
  const [otpResult, setOtpResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { messages: got } = await fetchOutbox(filter || undefined);
      setMessages(got ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
    if (!autoRefresh) return;
    const timer = setInterval(() => void refresh(), 2_000);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  async function triggerOtp() {
    setOtpResult(null);
    try {
      await sendOtp(phone);
      setOtpResult("sent — the code should appear below within a moment");
      await refresh();
    } catch (e) {
      setOtpResult(`send failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function checkOtp() {
    setOtpResult(null);
    try {
      await verifyOtp(phone, code);
      setOtpResult("verified — the real auth path accepted this code");
    } catch (e) {
      setOtpResult(`verify failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Copies the code from a captured SMS into the verify box. */
  function useCode(value: string) {
    setCode(value);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          OTP round trip
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          Calls the real <code className="font-mono">/auth/otp/send</code> and{" "}
          <code className="font-mono">/auth/otp/verify</code>. Only delivery is swapped, so the rate
          limiter and validation still apply — three sends an hour per number.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-48 rounded border border-neutral-300 px-2 py-1.5 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-800"
            />
          </label>
          <button
            type="button"
            onClick={() => void triggerOtp()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Send OTP
          </button>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              className="w-28 rounded border border-neutral-300 px-2 py-1.5 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-800"
            />
          </label>
          <button
            type="button"
            onClick={() => void checkOtp()}
            disabled={code.length === 0}
            className="rounded border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40 dark:border-neutral-600"
          >
            Verify
          </button>
        </div>
        {otpResult ? <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{otpResult}</p> : null}
      </section>

      <section className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Outbox</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          >
            <option value="">all channels</option>
            <option value="sms">sms</option>
            <option value="email">email</option>
            <option value="push">push</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-neutral-500">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            auto-refresh
          </label>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-600"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void clearOutbox().then(refresh)}
            className="rounded border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-600"
          >
            Clear
          </button>
        </div>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        {messages.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing captured yet. Trigger an OTP above, or do anything that sends a notification.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {messages.map((m) => (
              <li key={m.id} className="py-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-xs uppercase dark:bg-neutral-700">
                    {m.kind}
                  </span>
                  <span className="font-mono text-sm text-neutral-800 dark:text-neutral-200">{m.to}</span>
                  <span className="text-xs text-neutral-400">{new Date(m.at).toLocaleTimeString()}</span>
                  {m.code ? (
                    <button
                      type="button"
                      onClick={() => useCode(m.code!)}
                      title="Use this code in the verify box above"
                      className="rounded bg-green-600 px-2 py-0.5 font-mono text-sm font-bold text-white"
                    >
                      {m.code}
                    </button>
                  ) : null}
                </div>
                {m.subject ? (
                  <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    {m.subject}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                  className="mt-1 text-xs text-blue-600 underline"
                >
                  {expanded === m.id ? "hide body" : "view body"}
                </button>
                {expanded === m.id ? (
                  <>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-neutral-100 p-3 font-mono text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                      {m.body}
                    </pre>
                    <p className="mt-1 text-xs text-neutral-400">
                      {/* Rendered as text, never as HTML. An email body is
                          attacker-influenced content (a name, an address), and
                          this page is same-origin with the app's session. */}
                      shown as source · {m.provider}
                    </p>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
