"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";

import { CALL_EXPAND_EVENT, useCall, useCallScreen } from "@/components/consumer/call/call-provider";
import { ClinicalNotesClient } from "@/components/consumer/clinical-notes-client";
import { PrescriptionClient } from "@/components/consumer/prescription-client";
import { visitWindowId } from "@/components/consumer/workspace/apps";
import { CalendarApp } from "@/components/consumer/workspace/calendar-app";
import { ChatApp } from "@/components/consumer/workspace/chat-app";
import { DesktopIcons } from "@/components/consumer/workspace/desktop-icons";
import { Dock } from "@/components/consumer/workspace/dock";
import { FileStationApp } from "@/components/consumer/workspace/file-station";
import { FileViewerApp } from "@/components/consumer/workspace/file-viewer";
import { MeetApp } from "@/components/consumer/workspace/meet";
import { PatientApp } from "@/components/consumer/workspace/patient-app";
import { PhoneShell } from "@/components/consumer/workspace/phone-shell";
import { TopBar } from "@/components/consumer/workspace/top-bar";
import { VisitsApp } from "@/components/consumer/workspace/visits-app";
import {
  SnapGhost,
  WindowFrame,
  WindowManagerProvider,
  useWindows,
  useWorkspaceMode,
  type WorkspaceWindow,
} from "@/components/consumer/workspace/window-manager";
import { browserApi } from "@/lib/consumer/api/client";
import type { Appointment, VaultDocument } from "@/lib/consumer/api/types";
import type { CallPointerBind } from "@/lib/consumer/features/pointer";

export function WorkspaceDesktop() {
  const mode = useWorkspaceMode();
  if (!mode) return <div className="ws-desktop" />;
  return (
    <Suspense fallback={<div className="ws-desktop" />}>
      <WindowManagerProvider mode={mode}>
        <WorkspaceInner />
      </WindowManagerProvider>
    </Suspense>
  );
}

function visitName(a: Appointment) {
  return a.visit_patient_name || a.patient_name || a.counterpart_name || "Patient";
}

function WorkspaceInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramId = searchParams.get("call");
  const { call, activeId, start, stop } = useCall();
  const callId = paramId || activeId;
  const { mode, windows, open, close, restore, focusedId } = useWindows();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [viewers, setViewers] = useState<Record<string, VaultDocument>>({});

  const meet = windows.find((w) => w.id === "meet");
  const meetVisible = Boolean(meet && !meet.minimized && (mode !== "phone" || focusedId === "meet"));
  useCallScreen(Boolean(callId && meetVisible));

  useEffect(() => {
    if (paramId && activeId !== paramId) start(paramId);
  }, [activeId, paramId, start]);

  const openVisit = useCallback(
    (appointmentId: string, app: "patient" | "notes" | "rx", label: string, background = false) => {
      const title = app === "patient" ? label : `${app === "notes" ? "Notes" : "Prescription"} · ${label}`;
      open(app, { id: visitWindowId(app, appointmentId), title, props: { appointmentId }, background });
    },
    [open],
  );

  useEffect(() => {
    if (!callId) {
      setPatientId(null);
      return;
    }
    open("meet");
    let cancelled = false;
    browserApi<Appointment>(`/appointments/${callId}`)
      .then((appointment) => {
        if (cancelled) return;
        setPatientId(appointment.patient_id ?? null);
        const label = visitName(appointment);
        // Ready in the dock/recents for the whole consultation, without
        // piling windows on top of the video.
        openVisit(callId, "patient", label, true);
        openVisit(callId, "notes", label, true);
        openVisit(callId, "rx", label, true);
      })
      .catch(() => {
        if (!cancelled) setPatientId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [callId, open, openVisit]);

  useEffect(() => {
    const onExpand = () => restore("meet");
    window.addEventListener(CALL_EXPAND_EVENT, onExpand);
    return () => window.removeEventListener(CALL_EXPAND_EVENT, onExpand);
  }, [restore]);

  function joinCall(id: string) {
    router.replace(`/workspace?call=${encodeURIComponent(id)}`);
  }

  function leaveCall() {
    stop();
    if (paramId) router.replace("/workspace");
  }

  function onEnded() {
    const id = callId;
    stop();
    if (paramId) router.replace("/workspace");
    if (!id) return;
    for (const app of ["rx", "notes"] as const) {
      const win = windows.find((w) => w.id === visitWindowId(app, id));
      if (win) restore(win.id);
    }
  }

  function openFile(doc: VaultDocument) {
    setViewers((current) => ({ ...current, [doc.id]: doc }));
    open("viewer", { id: `viewer:${doc.id}`, title: doc.filename, props: { id: doc.id } });
  }

  function closeMeet() {
    if (callId && (call.live || call.waiting) && mode !== "phone") {
      if (!window.confirm("Leave this call?")) return;
      leaveCall();
    }
    close("meet");
  }

  function closeWindow(win: WorkspaceWindow) {
    // On a phone, swiping Meet away keeps the call going in the floating tile.
    if (win.app === "meet" && mode !== "phone") closeMeet();
    else close(win.id);
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

  function renderApp(win: WorkspaceWindow): ReactNode {
    const appointmentId = win.props.appointmentId;
    const label = win.title.split(" · ").pop() || "Patient";
    switch (win.app) {
      case "meet":
        return (
          <MeetApp call={call} callId={callId} onJoin={joinCall} onLeave={leaveCall} onEnded={onEnded} />
        );
      case "files":
        return <FileStationApp lockedRoot={callId ? patientId : null} onOpenFile={openFile} pointer={pointer} />;
      case "calendar":
        return <CalendarApp />;
      case "chat":
        return <ChatApp transport={callId ? call.chat : null} />;
      case "viewer": {
        const doc = win.props.id ? viewers[win.props.id] : undefined;
        return doc ? <FileViewerApp doc={doc} pointer={pointer} /> : null;
      }
      case "visits":
        return (
          <VisitsApp
            onJoin={joinCall}
            onOpen={(a, app) => openVisit(a.id, app, visitName(a))}
          />
        );
      case "patient":
        return appointmentId ? (
          <PatientApp appointmentId={appointmentId} onOpen={(app) => openVisit(appointmentId, app, label)} />
        ) : null;
      case "notes":
        return appointmentId ? (
          <div className="ws-body-light">
            <ClinicalNotesClient appointmentId={appointmentId} embedded />
          </div>
        ) : null;
      case "rx":
        return appointmentId ? (
          <div className="ws-body-light">
            <PrescriptionClient appointmentId={appointmentId} embedded />
          </div>
        ) : null;
    }
  }

  const topBar = <TopBar call={call} callId={callId} compact={mode === "phone"} />;

  if (mode === "phone") {
    return (
      <PhoneShell
        topBar={topBar}
        renderApp={renderApp}
        onCloseWindow={closeWindow}
        home={<PhoneHomeCallCard callId={callId} />}
      />
    );
  }

  return (
    <div className="ws-desktop">
      {topBar}
      <DesktopIcons />
      <div className="ws-windows">
        {windows.map((win) => (
          <WindowFrame key={win.id} win={win} onClose={() => closeWindow(win)}>
            {renderApp(win)}
          </WindowFrame>
        ))}
        <SnapGhost />
      </div>
      <Dock onExit={() => router.push("/dashboard")} />
    </div>
  );
}

function PhoneHomeCallCard({ callId }: { callId: string | null }) {
  const { call } = useCall();
  const { open } = useWindows();
  if (!callId || !(call.live || call.waiting)) return null;
  return (
    <button
      type="button"
      onClick={() => open("meet")}
      className="glass-dark mb-6 flex w-full items-center gap-3 rounded-2xl p-3 text-left text-white transition-[scale] duration-[140ms] ease-out active:scale-[0.98]"
    >
      <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-success" />
      <span className="min-w-0 flex-1">
        <span className="block text-label">{call.live ? "Consultation in progress" : "Patient waiting"}</span>
        <span className="block truncate text-caption text-white/60">{call.counterpartName || "Tap to return"}</span>
      </span>
      <span className="text-body-sm font-semibold text-brand-tint">Open</span>
    </button>
  );
}
