"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  FileText,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";

import { ChatPanel } from "@/components/consumer/call/chat-panel";
import { VaultBrowser } from "@/components/consumer/vault/vault-browser";
import { Alert } from "@/components/consumer/ui/Alert";
import { Badge } from "@/components/consumer/ui/Badge";
import { Button } from "@/components/consumer/ui/Button";
import { Tabs } from "@/components/consumer/ui/Tabs";
import { createMemoryChat } from "@/lib/consumer/features/chat";
import { afterEndPath } from "@/lib/consumer/features/consult";
import { useConsultation } from "@/lib/consumer/features/use-consultation";
import { formatVisitClock, formatVisitDate } from "@/lib/consumer/features/patient-appointment";
import { formatWait } from "@/lib/consumer/money";
import { cx } from "@/lib/consumer/cx";

export function PatientCall({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const call = useConsultation(appointmentId, "patient");
  const [panel, setPanel] = useState<"chat" | "files" | null>(null);
  const chat = useRef(createMemoryChat()).current;
  const afterEnd = afterEndPath("patient", appointmentId);

  useEffect(() => {
    if (call.status === "ended" || call.status === "abandoned") {
      router.replace(afterEnd);
    }
  }, [afterEnd, call.status, router]);

  const inCall = call.live;

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
            <PipTile videoRef={call.localRef} />
            <div className="absolute left-4 top-4">
              <Badge tone="success" dot className="bg-white/90">
                {call.counterpartName || "Live"}
              </Badge>
            </div>
          </>
        ) : (
          <Lobby call={call} />
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
            </>
          ) : null}
          <Button
            variant="danger"
            size="sm"
            busy={call.ending}
            leading={<PhoneOff className="size-4" />}
            onClick={() => void call.end().then(() => router.push(afterEnd))}
          >
            End call
          </Button>
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
              <ChatPanel transport={chat} />
            ) : (
              <VaultBrowser mode="owner" compact />
            )}
          </div>
        </aside>
      ) : null}

      {call.notice ? <Alert tone="info" className="absolute bottom-20 left-4 right-4">{call.notice}</Alert> : null}
      {call.error ? <Alert tone="danger" className="absolute bottom-20 left-4 right-4">{call.error}</Alert> : null}
      {call.noRelay && !inCall ? (
        <Alert tone="warning" title="No relay server configured" className="absolute left-4 right-4 top-4">
          The call may not connect on mobile data.
        </Alert>
      ) : null}
    </div>
  );
}

function Lobby({ call }: { call: ReturnType<typeof useConsultation> }) {
  const when = call.join?.scheduled_at;
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
        <p className="text-h3">{call.counterpartName || "Your doctor"}</p>
        {when ? (
          <p className="mt-1 text-body text-white/70 tabular-time">
            {formatVisitDate(when)} · {formatVisitClock(when)}
          </p>
        ) : null}
        <p className="mt-3 text-body text-white/80 tabular-time">
          Position #{call.queue?.position ?? "—"} · {formatWait(call.queue?.estimated_wait_seconds)}
        </p>
        <p className="mt-2 text-body-sm text-white/60">
          {call.connecting ? "Connecting…" : "You’ll enter the call when the doctor admits you."}
        </p>
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
