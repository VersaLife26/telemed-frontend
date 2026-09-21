export type PointerSurface = "video" | "file";

export type PointerState = {
  x: number;
  y: number;
  active: boolean;
  surface: PointerSurface;
  fileId?: string;
};

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function pointerFromEvent(
  event: { clientX: number; clientY: number; currentTarget: EventTarget | null },
  surface: PointerSurface,
  fileId?: string,
): PointerState | null {
  const el = event.currentTarget as HTMLElement | null;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: clamp01((event.clientX - rect.left) / rect.width),
    y: clamp01((event.clientY - rect.top) / rect.height),
    active: true,
    surface,
    fileId,
  };
}

export function parsePointer(data: unknown): PointerState | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const surface = raw.surface === "file" ? "file" : "video";
  const fileId = typeof raw.fileId === "string" && raw.fileId ? raw.fileId : undefined;
  if (raw.active === false) {
    return { x: 0, y: 0, active: false, surface, fileId };
  }
  if (typeof raw.x !== "number" || typeof raw.y !== "number") return null;
  return {
    x: clamp01(raw.x),
    y: clamp01(raw.y),
    active: true,
    surface,
    fileId,
  };
}

export function pointerMatches(
  pointer: PointerState | null | undefined,
  surface: PointerSurface,
  fileId?: string,
): pointer is PointerState {
  if (!pointer?.active) return false;
  if (pointer.surface !== surface) return false;
  if (surface === "file") return Boolean(fileId) && pointer.fileId === fileId;
  return true;
}

export type CallPointerBind = {
  pointing: boolean;
  localPointer: PointerState | null;
  remotePointer: PointerState | null;
  incomingLabel?: string;
  movePointer: (next: PointerState) => void;
  leavePointer: () => void;
};
