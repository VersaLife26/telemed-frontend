"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { CalendarApp } from "@/components/consumer/workspace/calendar-app";
import { ChatApp } from "@/components/consumer/workspace/chat-app";
import { DesktopIcons } from "@/components/consumer/workspace/desktop-icons";
import { Dock } from "@/components/consumer/workspace/dock";
import { FileStationApp } from "@/components/consumer/workspace/file-station";
import { FileViewerApp } from "@/components/consumer/workspace/file-viewer";
import { MeetApp, MiniCall } from "@/components/consumer/workspace/meet";
import { TopBar } from "@/components/consumer/workspace/top-bar";
import {
  WindowFrame,
  WindowManagerProvider,
  useWindows,
} from "@/components/consumer/workspace/window-manager";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, VaultDocument } from "@/lib/consumer/api/types";
import type { CallPointerBind } from "@/lib/consumer/features/pointer";
import { useConsultation } from "@/lib/consumer/features/use-consultation";

export function WorkspaceDesktop() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink-900" />}>
      <WindowManagerProvider>
        <WorkspaceInner />
      </WindowManagerProvider>
    </Suspense>
  );
}

function Viewer({
  winId,
  docs,
  pointer,
}: {
  winId?: string;
  docs: Record<string, VaultDocument>;
  pointer?: CallPointerBind | null;
}) {
  if (!winId) return null;
  const doc = docs[winId];
  if (!doc) return null;
  return <FileViewerApp doc={doc} pointer={pointer} />;
}

function WorkspaceInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callId = searchParams.get("call");
  const call = useConsultation(callId, "doctor");
  const { windows, open, close, restore } = useWindows();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [viewers, setViewers] = useState<Record<string, VaultDocument>>({});

  useEffect(() => {
    if (!callId) {
      setPatientId(null);
      return;
    }
    open("meet");
    let cancelled = false;
    browserApi<Appointment>(`/appointments/${callId}`)
      .then((appointment) => {
        if (!cancelled) setPatientId(appointment.patient_id ?? null);
      })
      .catch(() => {
        if (!cancelled) setPatientId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [callId, open]);

  const meet = windows.find((w) => w.id === "meet");
  const showMini = Boolean(callId && call.live && meet?.minimized);

  function joinCall(id: string) {
    router.replace(`/workspace?call=${encodeURIComponent(id)}`);
  }

  function openFile(doc: VaultDocument) {
    setViewers((current) => ({ ...current, [doc.id]: doc }));
    open("viewer", { id: `viewer:${doc.id}`, title: doc.filename, props: { id: doc.id } });
  }

  function closeMeet() {
    if (callId && (call.live || call.waiting)) {
      if (!window.confirm("Leave this call?")) return;
      call.leave();
    }
    close("meet");
    if (callId) router.replace("/workspace");
  }

  function exitWorkspace() {
    if (callId && (call.live || call.waiting)) {
      if (!window.confirm("Leave this call?")) return;
      call.leave();
      router.push("/dashboard");
      return;
    }
    router.push("/dashboard");
  }

  const pointer: CallPointerBind | null = callId
    ? {
        pointing: call.pointing,
        localPointer: call.localPointer,
        remotePointer: call.remotePointer,
        incomingLabel: call.counterpartName || "Pointing",
        movePointer: call.movePointer,
        leavePointer: call.leavePointer,
      }
    : null;

  return (
    <div className="ws-desktop">
      <TopBar call={call} callId={callId} />
      <DesktopIcons />
      <div className="ws-windows">
        {windows.map((win) => (
          <WindowFrame
            key={win.id}
            win={win}
            onClose={win.app === "meet" ? closeMeet : undefined}
          >
            {win.app === "meet" ? (
              <MeetApp call={call} callId={callId} onJoin={joinCall} />
            ) : null}
            {win.app === "files" ? (
              <FileStationApp
                lockedRoot={callId ? patientId : null}
                onOpenFile={openFile}
                pointer={pointer}
              />
            ) : null}
            {win.app === "calendar" ? <CalendarApp /> : null}
            {win.app === "chat" ? <ChatApp transport={callId ? call.chat : null} /> : null}
            {win.app === "viewer" ? <Viewer winId={win.props.id} docs={viewers} pointer={pointer} /> : null}
          </WindowFrame>
        ))}
      </div>
      {showMini ? <MiniCall call={call} onRestore={() => restore("meet")} /> : null}
      <Dock onExit={exitWorkspace} />
    </div>
  );
}
