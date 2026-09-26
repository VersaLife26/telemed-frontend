"use client";

import { useState } from "react";

import { isNotFound } from "@/lib/consumer/api/errors";
import { callPath } from "@/lib/consumer/features/consult";
import { SURFACE } from "@/lib/consumer/surface";
import { createInstantMeeting } from "@/lib/test/api";

/**
 * Creates a test appointment that starts now and needs no payment, then hands
 * off to the real call screens -- so what gets tested is the product's own
 * join, waiting room, admit and signalling path, not a parallel test client.
 *
 * Sign in on this surface first. The counterpart (the other role) opens the
 * same appointment on their own surface; from a phone,
 * NEXT_PUBLIC_API_BASE_URL has to be reachable from that device, since the
 * signalling hub is reached directly rather than through Next.
 */
export function InstantMeetingPanel() {
  const [counterpart, setCounterpart] = useState("");
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    setAppointmentId(null);
    setBusy(true);
    try {
      const meeting = await createInstantMeeting(counterpart);
      setAppointmentId(meeting.appointmentId);
    } catch (e) {
      setError(
        isNotFound(e)
          ? "Not found: instant meetings are switched off on the API, or no active counterpart matches."
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setBusy(false);
    }
  }

  const patientPath = appointmentId ? callPath(appointmentId) : "";
  const doctorPath = appointmentId ? `/workspace?call=${encodeURIComponent(appointmentId)}` : "";
  const ownPath = SURFACE === "doctor" ? doctorPath : patientPath;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Instant meeting
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          Signed in as a {SURFACE === "doctor" ? "doctor" : "patient"}, enter the{" "}
          {SURFACE === "doctor" ? "patient" : "doctor"}&apos;s phone, email or user id. The
          appointment is marked as a test and skips payment, reminders and availability.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Counterpart
            <input
              value={counterpart}
              onChange={(e) => setCounterpart(e.target.value)}
              placeholder="+94771234567"
              className="w-72 rounded border border-neutral-300 px-2 py-1.5 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-800"
            />
          </label>
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy || counterpart.trim().length === 0}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Create meeting
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      {appointmentId ? (
        <section className="rounded-lg border border-neutral-300 bg-white p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900">
          <p className="mb-2 font-mono text-xs text-neutral-500">appointment {appointmentId}</p>
          <p className="mb-3">
            <a href={ownPath} className="text-blue-600 underline">
              Open the call here
            </a>
          </p>
          <p className="text-xs text-neutral-500">
            The counterpart opens{" "}
            <span className="font-mono text-neutral-700 dark:text-neutral-300">
              {SURFACE === "doctor" ? patientPath : doctorPath}
            </span>{" "}
            on the {SURFACE === "doctor" ? "patient" : "doctor"} site.
          </p>
        </section>
      ) : null}
    </div>
  );
}
