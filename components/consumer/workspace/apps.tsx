import {
  CalendarDays,
  ClipboardList,
  FileText,
  FolderClosed,
  MessageSquare,
  Pill,
  StickyNote,
  UserRound,
  Video,
} from "lucide-react";

export type WorkspaceApp =
  | "meet"
  | "files"
  | "calendar"
  | "chat"
  | "viewer"
  | "visits"
  | "patient"
  | "notes"
  | "rx";

type AppMeta = {
  label: string;
  color: string;
  Icon: typeof Video;
  size: { w: number; h: number };
  min: { w: number; h: number };
  /** Shown on the desktop, the dock and the phone home screen. */
  launcher: boolean;
};

export const APPS: Record<WorkspaceApp, AppMeta> = {
  meet: { label: "Meet", color: "#2563eb", Icon: Video, size: { w: 880, h: 560 }, min: { w: 320, h: 260 }, launcher: true },
  visits: { label: "Visits", color: "#7c3aed", Icon: ClipboardList, size: { w: 720, h: 600 }, min: { w: 300, h: 320 }, launcher: true },
  files: { label: "File Station", color: "#f59e0b", Icon: FolderClosed, size: { w: 920, h: 600 }, min: { w: 320, h: 300 }, launcher: true },
  calendar: { label: "Calendar", color: "#dc2626", Icon: CalendarDays, size: { w: 980, h: 640 }, min: { w: 360, h: 320 }, launcher: true },
  chat: { label: "Chat", color: "#0d9488", Icon: MessageSquare, size: { w: 420, h: 520 }, min: { w: 280, h: 300 }, launcher: true },
  patient: { label: "Patient", color: "#0891b2", Icon: UserRound, size: { w: 400, h: 520 }, min: { w: 280, h: 280 }, launcher: false },
  notes: { label: "Notes", color: "#16a34a", Icon: StickyNote, size: { w: 640, h: 680 }, min: { w: 320, h: 320 }, launcher: false },
  rx: { label: "Prescription", color: "#db2777", Icon: Pill, size: { w: 680, h: 700 }, min: { w: 320, h: 320 }, launcher: false },
  viewer: { label: "Preview", color: "#64748b", Icon: FileText, size: { w: 740, h: 560 }, min: { w: 300, h: 240 }, launcher: false },
};

export const LAUNCHER_APPS = (Object.keys(APPS) as WorkspaceApp[]).filter((app) => APPS[app].launcher);

/** Apps opened per visit get one window per appointment. */
export function visitWindowId(app: "patient" | "notes" | "rx", appointmentId: string): string {
  return `${app}:${appointmentId}`;
}

export function AppIcon({ app, size = "md" }: { app: WorkspaceApp; size?: "sm" | "md" | "lg" }) {
  const { color, Icon } = APPS[app];
  const box = size === "sm" ? "size-8 rounded-[10px]" : size === "lg" ? "size-14 rounded-[18px]" : "size-12 rounded-2xl";
  const glyph = size === "sm" ? "size-4" : size === "lg" ? "size-7" : "size-6";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center shadow-md ring-1 ring-white/15 ring-inset ${box}`}
      style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${color} 80%, white), ${color})` }}
    >
      <Icon className={`${glyph} text-white`} strokeWidth={1.75} />
    </span>
  );
}
