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
import { cx } from "@/lib/consumer/cx";

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
        <p className="text-body text-white/70">No confirmed visits today.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {appointments.map((appointment) => (
            <li
              key={appointment.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-white/10 px-3 py-2"
            >
              <div>
                <p className="text-label">
                  {appointment.counterpart_name || appointment.patient_name || "Patient"}
                </p>
                <p className="text-caption text-white/60 tabular-time">
                  {formatVisitClock(appointment.start_at_local || appointment.start_at)}
                </p>
              </div>
              <Button size="sm" onClick={() => onJoin(appointment.id)}>
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
      <div className="glass-panel-dark absolute inset-x-0 bottom-0 mx-auto mb-4 flex w-fit items-center gap-2 rounded-pill px-3 py-2">
        <Button
          variant="glass"
          size="sm"
          aria-pressed={call.muted}
          leading={call.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          onClick={call.toggleMute}
        >
          {call.muted ? "Unmute" : "Mute"}
        </Button>
        <Button
          variant="glass"
          size="sm"
          aria-pressed={call.cameraOff}
          leading={call.cameraOff ? <VideoOff className="size-4" /> : <Video className="size-4" />}
          onClick={call.toggleCamera}
        >
          {call.cameraOff ? "Camera on" : "Camera off"}
        </Button>
        <Button
          variant="glass"
          size="sm"
          aria-pressed={call.sharing}
          leading={<MonitorUp className="size-4" />}
          onClick={() => void call.toggleScreenShare()}
        >
          Share
        </Button>
        <Button
          variant="danger"
          size="sm"
          busy={call.ending}
          leading={<PhoneOff className="size-4" />}
          onClick={() =>
            void call.end().then(() => {
              router.replace("/workspace");
            })
          }
        >
          End
        </Button>
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

export function MiniCall({ call }: { call: ConsultationControls }) {
  return (
    <div
      className={cx(
        "pointer-events-auto absolute bottom-24 right-6 overflow-hidden rounded-lg shadow-lg ring-1 ring-white/30",
        "h-36 w-52",
      )}
    >
      <video ref={call.remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
    </div>
  );
}
