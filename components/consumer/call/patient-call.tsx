"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  CalendarDays,
  FileText,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  MousePointer2,
} from "lucide-react";

import { ChatPanel } from "@/components/consumer/call/chat-panel";
import { IncomingSelfView, PointerLayer } from "@/components/consumer/call/pointer-layer";
import { VaultBrowser } from "@/components/consumer/vault/vault-browser";
import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { Button, ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { Tabs } from "@/components/consumer/ui/Tabs";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, Doctor } from "@/lib/consumer/api/types";
import {
  afterEndPath,
  consultJoinError,
  isBeforeJoinWindow,
  isJoinWindow,
  isPastLateJoinCutoff,
} from "@/lib/consumer/features/consult";
import {
  appointmentDoctorName,
  formatVisitClock,
  formatVisitDate,
} from "@/lib/consumer/features/patient-appointment";
import { useConsultation } from "@/lib/consumer/features/use-consultation";
import { formatWait } from "@/lib/consumer/money";
import { cx } from "@/lib/consumer/cx";

export function PatientCall({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [doctorName, setDoctorName] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const visit = await browserApi<Appointment>(`/appointments/${appointmentId}`);
        if (cancelled) return;
        setAppointment(visit);
        if (visit.counterpart_name?.trim()) {
          setDoctorName(visit.counterpart_name.trim());
          return;
        }
        if (!visit.doctor_id) return;
        const doctor = await browserApi<Doctor>(`/doctors/${visit.doctor_id}`).catch(() => null);
        if (!cancelled && doctor?.display_name) setDoctorName(doctor.display_name);
      } catch {
        if (!cancelled) setAppointment(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const startAt = appointment?.start_at_local || appointment?.start_at;
  const endAt = appointment?.end_at_local || appointment?.end_at;
  const open = isJoinWindow(startAt, endAt, now);
  const tooSoon = isBeforeJoinWindow(startAt, now);
  const tooLate = isPastLateJoinCutoff(startAt, now, endAt);
  const name = appointmentDoctorName(appointment ?? { id: appointmentId }, {
    [appointment?.doctor_id || ""]: doctorName,
  });

  const call = useConsultation(open ? appointmentId : null, "patient");
  const [panel, setPanel] = useState<"chat" | "files" | null>(null);
  const afterEnd = afterEndPath("patient", appointmentId);

  useEffect(() => {
    if (call.status === "ended" || call.status === "abandoned") {
      router.replace(afterEnd);
    }
  }, [afterEnd, call.status, router]);

  const inCall = call.live;

  if (!appointment) {
    return <p className="text-body text-muted">Loading visit…</p>;
  }

  if (tooSoon || tooLate) {
    return (
      <VisitHold
        doctorName={name}
        startAt={startAt}
        tooLate={tooLate}
      />
    );
  }

  return (
    <div className="relative flex min-h-[min(70vh,40rem)] flex-col gap-4 lg:flex-row">
      <div className="relative min-h-[20rem] min-w-0 flex-1 overflow-hidden rounded-xl bg-ink-900 shadow-lg">
        {inCall ? (
          <>
            <video
              ref={call.remoteRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
            <IncomingSelfView
              source={call.localRef}
              show={Boolean(call.remotePointer?.active && call.remotePointer.surface === "video" && !call.pointing)}
            />
            <PointerLayer
              pointing={call.pointing}
              local={call.localPointer}
              remote={call.remotePointer}
              surface="video"
              incomingLabel={call.counterpartName || name || "Pointing"}
              onMove={call.movePointer}
              onLeave={call.leavePointer}
            />
            <PipTile videoRef={call.localRef} />
            <div className="absolute left-4 top-4">
              <Badge tone="success" dot className="bg-white/90">
                {call.counterpartName || name || "Live"}
              </Badge>
            </div>
          </>
        ) : (
          <Lobby call={call} doctorName={call.counterpartName || name} startAt={startAt} />
        )}

        <div className="glass-panel-dark absolute inset-x-0 bottom-0 mx-auto mb-4 flex w-fit items-center gap-2 rounded-pill px-3 py-2">
          <Button
            variant="glass"
            size="sm"
            aria-pressed={call.muted}
            aria-label={call.muted ? "Unmute" : "Mute"}
            leading={call.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            onClick={call.toggleMute}
          >
            {call.muted ? "Unmute" : "Mute"}
          </Button>
          <Button
            variant="glass"
            size="sm"
            aria-pressed={call.cameraOff}
            aria-label={call.cameraOff ? "Turn camera on" : "Turn camera off"}
            leading={call.cameraOff ? <VideoOff className="size-4" /> : <Video className="size-4" />}
            onClick={call.toggleCamera}
          >
            {call.cameraOff ? "Camera on" : "Camera off"}
          </Button>
          {inCall ? (
            <>
              <Button
                variant="glass"
                size="sm"
                aria-pressed={call.pointing}
                aria-label={call.pointing ? "Stop pointing" : "Point"}
                leading={<MousePointer2 className="size-4" />}
                onClick={call.togglePointing}
              >
                {call.pointing ? "Pointing" : "Point"}
              </Button>
              <Button
                variant="glass"
                size="sm"
                aria-pressed={panel === "chat"}
                leading={<MessageSquare className="size-4" />}
                onClick={() => setPanel((p) => (p === "chat" ? null : "chat"))}
              >
                Chat
              </Button>
              <Button
                variant="glass"
                size="sm"
                aria-pressed={panel === "files"}
                leading={<FileText className="size-4" />}
                onClick={() => setPanel((p) => (p === "files" ? null : "files"))}
              >
                Files
              </Button>
              <Button
                variant="danger"
                size="sm"
                busy={call.ending}
                leading={<PhoneOff className="size-4" />}
                onClick={() => void call.end().then(() => router.push(afterEnd))}
              >
                End call
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => router.push("/appointments")}>
              Leave
            </Button>
          )}
        </div>
      </div>

      {inCall && panel ? (
        <aside className="flex h-[min(70vh,40rem)] w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface lg:w-[22rem]">
          <div className="p-3">
            <Tabs
              label="Side panel"
              value={panel}
              onChange={setPanel}
              items={[
                { value: "chat", label: "Chat" },
                { value: "files", label: "Files" },
              ]}
            />
          </div>
          <div className="min-h-0 flex-1">
            {panel === "chat" ? (
              <ChatPanel transport={call.chat} />
            ) : (
              <VaultBrowser
                mode="owner"
                compact
                pointer={
                  inCall
                    ? {
                        pointing: call.pointing,
                        localPointer: call.localPointer,
                        remotePointer: call.remotePointer,
                        incomingLabel: call.counterpartName || name || "Pointing",
                        movePointer: call.movePointer,
                        leavePointer: call.leavePointer,
                      }
                    : null
                }
              />
            )}
          </div>
        </aside>
      ) : null}

      {inCall && call.remotePointer?.active && call.remotePointer.surface === "file" && panel !== "files" ? (
        <Alert tone="info" className="absolute bottom-20 left-4 right-4">
          {call.counterpartName || "The doctor"} is pointing on a file. Open Files to follow the laser.
        </Alert>
      ) : null}
      {call.notice ? <Alert tone="info" className="absolute bottom-20 left-4 right-4">{call.notice}</Alert> : null}
      {call.error ? (
        <Alert tone="danger" className="absolute bottom-20 left-4 right-4">
          <p>{consultJoinError(call.error)}</p>
          {!call.hasLocalMedia ? (
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => void call.retryMedia()}>
              Try again
            </Button>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
}

function VisitHold({
  doctorName,
  startAt,
  tooLate,
}: {
  doctorName: string;
  startAt?: string;
  tooLate: boolean;
}) {
  return (
    <Card className="mx-auto flex w-full max-w-lg flex-col gap-5 p-8 text-center">
      <span
        aria-hidden="true"
        className="mx-auto flex size-12 items-center justify-center rounded-full bg-tint text-brand"
      >
        <CalendarDays className="size-6" />
      </span>
      <div>
        <p className="text-eyebrow text-brand">{tooLate ? "Visit ended" : "You’re booked"}</p>
        <h1 className="mt-2 text-h2 text-ink">{doctorName}</h1>
        {startAt ? (
          <p className="mt-2 text-body text-muted tabular-time">
            {formatVisitDate(startAt)} · {formatVisitClock(startAt)}
          </p>
        ) : null}
      </div>
      <p className="text-body text-muted">
        {tooLate
          ? "This slot has ended. If you still need care, book another time."
          : "The waiting room opens 15 minutes before your slot. You don’t need to sit here until then."}
      </p>
      <ButtonLink href="/appointments" fullWidth>
        Back to appointments
      </ButtonLink>
    </Card>
  );
}

function Lobby({
  call,
  doctorName,
  startAt,
}: {
  call: ReturnType<typeof useConsultation>;
  doctorName: string;
  startAt?: string;
}) {
  const when = call.join?.scheduled_at || startAt;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <video
        ref={call.localRef}
        autoPlay
        muted
        playsInline
        className={cx(
          "h-48 w-64 rounded-lg object-cover ring-2 ring-white/40",
          call.cameraOff && "opacity-30",
        )}
      />
      <div className="text-white">
        <p className="text-h3">{doctorName || "Your doctor"}</p>
        {when ? (
          <p className="mt-1 text-body text-white/70 tabular-time">
            {formatVisitDate(when)} · {formatVisitClock(when)}
          </p>
        ) : null}
        {call.queue?.position != null ? (
          <p className="mt-3 text-body text-white/80 tabular-time">
            Position #{call.queue.position} · {formatWait(call.queue.estimated_wait_seconds)}
          </p>
        ) : null}
        <p className="mt-2 text-body-sm text-white/60">
          {call.connecting ? "Connecting…" : "You’ll enter the call when the doctor admits you."}
        </p>
        {!call.hasLocalMedia && !call.connecting ? (
          <div className="mt-4">
            <Button size="lg" onClick={() => void call.retryMedia()}>
              Enable camera and microphone
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PipTile({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  return (
    <div
      className="absolute h-28 w-40 cursor-grab overflow-hidden rounded-md shadow-lg ring-2 ring-white/70 active:cursor-grabbing"
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : { right: 16, bottom: 80 }}
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const parent = event.currentTarget.parentElement?.getBoundingClientRect();
        if (!parent) return;
        drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const parent = event.currentTarget.parentElement?.getBoundingClientRect();
        if (!parent) return;
        setPos({
          x: Math.max(8, Math.min(parent.width - 168, event.clientX - parent.left - drag.current.dx)),
          y: Math.max(8, Math.min(parent.height - 120, event.clientY - parent.top - drag.current.dy)),
        });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
    </div>
  );
}
