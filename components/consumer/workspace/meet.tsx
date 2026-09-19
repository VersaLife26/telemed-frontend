"use client";

import { useRouter } from "next/navigation";
import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { Button } from "@/components/consumer/ui/Button";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment } from "@/lib/consumer/api/types";
import { appointmentsListPath } from "@/lib/consumer/features/appointments";
import { colomboDayKey } from "@/lib/consumer/features/calendar";
import { admitDisabled, canAdmit, consultJoinError, doctorLobbyCopy } from "@/lib/consumer/features/consult";
import { formatVisitClock } from "@/lib/consumer/features/patient-appointment";
import type { ConsultationControls } from "@/lib/consumer/features/use-consultation";

export function MeetApp({
  call,
  callId,
  onJoin,
}: {
  call: ConsultationControls;
  callId: string | null;
  onJoin: (id: string) => void;
}) {
  if (!callId) return <MeetQueue onJoin={onJoin} />;
  if (call.live) return <MeetLive call={call} />;
  return <MeetWaiting call={call} />;
}

function MeetQueue({ onJoin }: { onJoin: (id: string) => void }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const today = colomboDayKey(new Date());

  useEffect(() => {
    let cancelled = false;
    browserApi<Appointment[]>(`${appointmentsListPath()}&status=confirmed`)
      .then((data) => {
        if (cancelled) return;
        const list = (Array.isArray(data) ? data : []).filter((a) => colomboDayKey(a.start_at || "") === today);
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
                  {appointment.counterpart_name || appointment.patient_name || "Patient"}
                </p>
                <p className="text-caption text-white/60 tabular-time">
                  {formatVisitClock(appointment.start_at_local || appointment.start_at)}
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

function MeetWaiting({ call }: { call: ConsultationControls }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-white">
      <p className="text-h3">{call.counterpartName || "Patient"}</p>
      <p className="text-body text-white/70">{doctorLobbyCopy(call.status)}</p>
      {canAdmit("doctor", call.status, call.join?.status) ? (
        <Button
          size="lg"
          busy={call.admitting}
          disabled={call.admitting || admitDisabled(call.status)}
          onClick={() => void call.admit()}
        >
          Admit
        </Button>
      ) : null}
      {call.error ? <Alert tone="danger">{consultJoinError(call.error, "doctor")}</Alert> : null}
    </div>
  );
}

function MeetLive({ call }: { call: ConsultationControls }) {
  const router = useRouter();
  return (
    <div className="relative h-full bg-black">
      <video ref={call.remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
      <video
        ref={call.localRef}
        autoPlay
        muted
        playsInline
        className="absolute bottom-20 right-4 h-28 w-40 rounded-md object-cover ring-2 ring-white/70"
      />
      <div className="absolute left-4 top-4">
        <Badge tone="success" dot className="bg-white/90">
          {call.counterpartName || "Live"}
        </Badge>
      </div>
      <div className="ws-call-bar absolute inset-x-0 bottom-0">
        <button
          type="button"
          className="ws-call-btn"
          aria-label={call.muted ? "Unmute" : "Mute"}
          aria-pressed={call.muted}
          onClick={call.toggleMute}
        >
          {call.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>
        <button
          type="button"
          className="ws-call-btn"
          aria-label={call.cameraOff ? "Turn camera on" : "Turn camera off"}
          aria-pressed={call.cameraOff}
          onClick={call.toggleCamera}
        >
          {call.cameraOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
        </button>
        <button
          type="button"
          className="ws-call-btn"
          aria-label={call.sharing ? "Stop sharing" : "Share screen"}
          aria-pressed={call.sharing}
          onClick={() => void call.toggleScreenShare()}
        >
          <MonitorUp className="size-5" />
        </button>
        <button
          type="button"
          className="ws-call-btn ws-call-btn-end"
          aria-label="End call"
          disabled={call.ending}
          onClick={() =>
            void call.end().then(() => {
              router.replace("/workspace");
            })
          }
        >
          <PhoneOff className="size-5" />
        </button>
      </div>
      {call.notice ? (
        <Alert tone="info" className="absolute left-4 right-4 top-16">
          {call.notice}
        </Alert>
      ) : null}
      {call.error ? (
        <Alert tone="danger" className="absolute left-4 right-4 top-16">
          {call.error}
        </Alert>
      ) : null}
    </div>
  );
}

export function MiniCall({
  call,
  onRestore,
}: {
  call: ConsultationControls;
  onRestore: () => void;
}) {
  return (
    <button type="button" className="ws-mini-call" aria-label="Restore Meet" onClick={onRestore}>
      <video ref={call.remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
    </button>
  );
}
