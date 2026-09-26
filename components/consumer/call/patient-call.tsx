"use client";

import { useRouter } from "next/navigation";
import { animate, motion, useDragControls, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { CalendarDays, FileText, MessageSquare, Mic, MicOff, Video, VideoOff, X } from "lucide-react";

import { useCall, useCallScreen } from "@/components/consumer/call/call-provider";
import { CallStage } from "@/components/consumer/call/call-stage";
import { ChatPanel } from "@/components/consumer/call/chat-panel";
import { StreamVideo } from "@/components/consumer/call/stream-video";
import { VaultBrowser } from "@/components/consumer/vault/vault-browser";
import { Alert } from "@/components/consumer/ui/Alert";
import { Button, ButtonLink } from "@/components/consumer/ui/Button";
import { Card } from "@/components/consumer/ui/Card";
import { Tabs } from "@/components/consumer/ui/Tabs";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, Doctor } from "@/lib/consumer/api/types";
import {
  afterEndPath,
  isBeforeJoinWindow,
  isConsultTerminal,
  isJoinWindow,
  isPastLateJoinCutoff,
} from "@/lib/consumer/features/consult";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";
import type { ConsultationControls } from "@/lib/consumer/features/use-consultation";
import { formatWait } from "@/lib/consumer/money";
import { cx } from "@/lib/consumer/cx";
import { project, spring } from "@/lib/consumer/motion";

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
        const doctor = await browserApi<Doctor>(`/doctors/${visit.doctorId}`).catch(() => null);
        if (!cancelled && doctor?.displayName) setDoctorName(doctor.displayName);
      } catch {
        if (!cancelled) setAppointment(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const startAt = appointment?.startAt;
  const endAt = appointment?.endAt;
  const open = isJoinWindow(startAt, endAt, now);
  const tooSoon = isBeforeJoinWindow(startAt, now);
  const tooLate = isPastLateJoinCutoff(startAt, now, endAt);
  const name = doctorName || "Consultation";

  const { call, activeId, start, stop } = useCall();
  const [panel, setPanel] = useState<"chat" | "files" | null>(null);
  const afterEnd = afterEndPath("patient", appointmentId);
  const mine = activeId === appointmentId;
  const [closed, setClosed] = useState(false);
  const onScreen = Boolean(appointment) && !tooSoon && !tooLate;
  useCallScreen(onScreen);

  useEffect(() => {
    if (open && !mine && !closed) start(appointmentId);
  }, [appointmentId, closed, mine, open, start]);

  useEffect(() => {
    if (mine && isConsultTerminal(call.status)) {
      setClosed(true);
      stop();
      router.replace(afterEnd);
    }
  }, [afterEnd, call.status, mine, router, stop]);

  const inCall = mine && call.live;
  const counterpart = call.counterpartName || name;

  function leave() {
    stop();
    router.push("/appointments");
  }

  if (!appointment) {
    return <p className="text-body text-muted">Loading visit…</p>;
  }

  if (tooSoon || tooLate) {
    return <VisitHold doctorName={name} startAt={startAt} tooLate={tooLate} />;
  }

  const alerts = (
    <>
      {inCall && call.remotePointer?.active && call.remotePointer.surface === "file" && panel !== "files" ? (
        <Alert tone="info">
          {counterpart || "The doctor"} is pointing on a file. Open Files to follow the laser.
        </Alert>
      ) : null}
      {call.notice ? <Alert tone="info">{call.notice}</Alert> : null}
      {call.error ? (
        <Alert tone="danger">
          <p>{call.error}</p>
          {!call.hasLocalMedia ? (
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => void call.retryMedia()}>
              Try again
            </Button>
          ) : null}
        </Alert>
      ) : null}
    </>
  );

  const panelBody =
    panel === "chat" ? (
      <ChatPanel transport={call.chat} />
    ) : panel === "files" ? (
      <VaultBrowser
        mode="owner"
        compact
        pointer={
          inCall
            ? {
                pointing: call.pointing,
                localPointer: call.localPointer,
                remotePointer: call.remotePointer,
                incomingLabel: counterpart || "Pointing",
                movePointer: call.movePointer,
                leavePointer: call.leavePointer,
              }
            : null
        }
      />
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex h-dvh bg-ink-900">
      <div className="relative min-h-0 min-w-0 flex-1">
        {inCall ? (
          <CallStage
            call={call}
            counterpart={counterpart}
            onLeave={leave}
            alerts={alerts}
            actions={[
              {
                id: "chat",
                label: "Chat",
                icon: <MessageSquare className="size-5" />,
                pressed: panel === "chat",
                onClick: () => setPanel((p) => (p === "chat" ? null : "chat")),
              },
              {
                id: "files",
                label: "Files",
                icon: <FileText className="size-5" />,
                pressed: panel === "files",
                onClick: () => setPanel((p) => (p === "files" ? null : "files")),
              },
            ]}
          />
        ) : (
          <Lobby call={call} doctorName={counterpart} startAt={startAt} onLeave={leave} alerts={alerts} />
        )}
      </div>

      {inCall && panel ? (
        <>
          <aside className="hidden h-full w-[22rem] shrink-0 flex-col overflow-hidden border-l border-white/10 bg-surface sm:flex">
            <PanelHeader panel={panel} setPanel={setPanel} />
            <div className="min-h-0 flex-1">{panelBody}</div>
          </aside>
          <PanelSheet onClose={() => setPanel(null)}>
            <PanelHeader panel={panel} setPanel={setPanel} />
            <div className="min-h-0 flex-1">{panelBody}</div>
          </PanelSheet>
        </>
      ) : null}
    </div>
  );
}

function PanelHeader({
  panel,
  setPanel,
}: {
  panel: "chat" | "files";
  setPanel: (next: "chat" | "files" | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 p-3">
      <div className="min-w-0 flex-1">
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
      <button
        type="button"
        aria-label="Close panel"
        onClick={() => setPanel(null)}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-[background-color,scale] duration-[140ms] ease-out active:scale-[0.94] can-hover:hover:bg-tint"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}

/** Below `sm` the side panel is a sheet over the call, thrown down to dismiss. */
function PanelSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const controls = useDragControls();
  const y = useMotionValue(0);

  function dismiss(velocity = 0) {
    if (reduceMotion) {
      onClose();
      return;
    }
    void animate(y, window.innerHeight, { ...spring, velocity }).then(onClose);
  }

  return (
    <div className="fixed inset-0 z-[60] sm:hidden">
      <motion.button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={() => dismiss()}
      />
      <motion.div
        role="dialog"
        aria-label="Call side panel"
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 1 }}
        onDragEnd={(_, info) => {
          const landing = y.get() + project(info.velocity.y);
          if (landing > window.innerHeight * 0.35 || info.velocity.y > 600) dismiss(info.velocity.y);
          else void animate(y, 0, { ...spring, velocity: info.velocity.y });
        }}
        initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
        animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
        transition={spring}
        style={{ y }}
        className="absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col overflow-hidden rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl"
      >
        <div
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          onPointerDown={(e) => controls.start(e)}
        >
          <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-ink-200" />
        </div>
        {children}
      </motion.div>
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
  onLeave,
  alerts,
}: {
  call: ConsultationControls;
  doctorName: string;
  startAt?: string;
  onLeave: () => void;
  alerts: React.ReactNode;
}) {
  const when = call.join?.scheduledStartAt || startAt;
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center">
      <div className="relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-2xl bg-ink-800 shadow-2xl ring-1 ring-white/15">
        <StreamVideo
          stream={call.localStream}
          muted
          className={cx("h-full w-full scale-x-[-1] object-cover", call.cameraOff && "opacity-0")}
        />
        <div className="glass-dark absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1.5 rounded-pill p-1.5">
          <LobbyToggle
            label={call.muted ? "Unmute" : "Mute"}
            on={!call.muted}
            onClick={call.toggleMute}
            icon={call.muted ? "mic-off" : "mic"}
          />
          <LobbyToggle
            label={call.cameraOff ? "Start video" : "Stop video"}
            on={!call.cameraOff}
            onClick={call.toggleCamera}
            icon={call.cameraOff ? "video-off" : "video"}
          />
        </div>
      </div>
      <div className="text-white">
        <p className="text-h3">{doctorName || "Your doctor"}</p>
        {when ? (
          <p className="mt-1 text-body text-white/70 tabular-time">
            {formatVisitDate(when)} · {formatVisitClock(when)}
          </p>
        ) : null}
        {call.queue?.waiting ? (
          <p className="mt-3 text-body text-white/80 tabular-time">
            Position #{call.queue.position} · {formatWait(call.queue.estimatedWaitSeconds)}
          </p>
        ) : null}
        <p className="mt-2 text-body-sm text-white/60">
          {call.connecting
            ? "Connecting…"
            : "You’ll enter the call when the doctor admits you. You can keep using the app meanwhile."}
        </p>
        {!call.hasLocalMedia && !call.connecting ? (
          <div className="mt-4">
            <Button size="lg" onClick={() => void call.retryMedia()}>
              Enable camera and microphone
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2">{alerts}</div>
      <Button variant="glass" onClick={onLeave}>
        Leave waiting room
      </Button>
    </div>
  );
}

function LobbyToggle({
  label,
  on,
  onClick,
  icon,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  icon: "mic" | "mic-off" | "video" | "video-off";
}) {
  const Icon = { mic: Mic, "mic-off": MicOff, video: Video, "video-off": VideoOff }[icon];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={!on}
      onClick={onClick}
      className={cx(
        "flex size-11 items-center justify-center rounded-full transition-[background-color,color,scale] duration-[140ms] ease-out active:scale-[0.94]",
        on ? "bg-white/10 text-white can-hover:hover:bg-white/20" : "bg-white text-ink",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
