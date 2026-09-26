"use client";

import { useEffect, useState } from "react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Button } from "@/components/consumer/ui/Button";
import { Modal } from "@/components/consumer/ui/Modal";
import { CallStage } from "@/components/consumer/call/call-stage";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, Paged } from "@/lib/consumer/api/types";
import { appointmentsListPath } from "@/lib/consumer/features/appointments";
import { colomboDayKey } from "@/lib/consumer/features/calendar";
import { admitDisabled, canAdmit, doctorLobbyCopy } from "@/lib/consumer/features/consult";
import { formatVisitClock } from "@/lib/consumer/features/patient-appointment";
import type { ConsultationControls } from "@/lib/consumer/features/use-consultation";

export function MeetApp({
  call,
  callId,
  onJoin,
  onLeave,
  onEnded,
}: {
  call: ConsultationControls;
  callId: string | null;
  onJoin: (id: string) => void;
  onLeave: () => void;
  onEnded: () => void;
}) {
  if (!callId) return <MeetQueue onJoin={onJoin} />;
  if (call.live) return <MeetLive call={call} onLeave={onLeave} onEnded={onEnded} />;
  return <MeetWaiting call={call} onLeave={onLeave} />;
}

function MeetQueue({ onJoin }: { onJoin: (id: string) => void }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const today = colomboDayKey(new Date());

  useEffect(() => {
    let cancelled = false;
    browserApi<Paged<Appointment>>(`${appointmentsListPath(100)}&status=confirmed`)
      .then((data) => {
        if (cancelled) return;
        const list = data.items.filter((a) => colomboDayKey(a.startAt) === today);
        setAppointments(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the queue");
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-white">
      <h3 className="text-h4">Today’s queue</h3>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {appointments.length === 0 && !error ? (
        <p className="text-body text-white/70">No confirmed visits today. When a patient is booked, they will appear here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {appointments.map((appointment) => (
            <li
              key={appointment.id}
              className="flex min-h-14 items-center justify-between gap-3 rounded-lg bg-white/10 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-label">
                  {appointment.visitPatient.name || "Patient"}
                </p>
                <p className="text-caption text-white/60 tabular-time">
                  {formatVisitClock(appointment.startAt)}
                </p>
              </div>
              <Button size="sm" className="min-h-11 shrink-0" onClick={() => onJoin(appointment.id)}>
                Join
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MeetWaiting({ call, onLeave }: { call: ConsultationControls; onLeave: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-white">
      <p className="text-h3">{call.counterpartName || "Patient"}</p>
      <p className="text-body text-white/70">{doctorLobbyCopy(call.status)}</p>
      {canAdmit("doctor", call.status, call.join?.status) ? (
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            busy={call.admitting}
            disabled={call.admitting || admitDisabled(call.status)}
            onClick={() => void call.admit()}
          >
            Admit
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/30 text-white can-hover:hover:bg-white/10"
            onClick={onLeave}
          >
            Leave lobby
          </Button>
        </div>
      ) : null}
      {call.error ? (
        <Alert tone="danger">
          <p>{call.error}</p>
          {!call.hasLocalMedia ? (
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => void call.retryMedia()}>
              Enable camera and microphone
            </Button>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}

function MeetLive({
  call,
  onLeave,
  onEnded,
}: {
  call: ConsultationControls;
  onLeave: () => void;
  onEnded: () => void;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const counterpart = call.counterpartName || "Patient";
  return (
    <>
      <CallStage
        call={call}
        counterpart={counterpart}
        onLeave={onLeave}
        topRight={
          <Button size="sm" variant="danger" busy={call.ending} onClick={() => setConfirmEnd(true)}>
            End consultation
          </Button>
        }
        alerts={
          <>
            {call.remotePointer?.active && call.remotePointer.surface === "file" ? (
              <Alert tone="info">
                {counterpart} is pointing on a file. Open the same document to follow the laser.
              </Alert>
            ) : null}
            {call.notice && !(call.remotePointer?.active && call.remotePointer.surface === "file") ? (
              <Alert tone="info">{call.notice}</Alert>
            ) : null}
            {call.error ? <Alert tone="danger">{call.error}</Alert> : null}
          </>
        }
      />
      <Modal
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="End this consultation?"
        description="Once ended, neither you nor the patient can rejoin. Your notes and prescription stay open so you can finish them."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
              Keep talking
            </Button>
            <Button
              variant="danger"
              busy={call.ending}
              onClick={() => {
                setConfirmEnd(false);
                void call.end().then(onEnded);
              }}
            >
              End consultation
            </Button>
          </>
        }
      />
    </>
  );
}
