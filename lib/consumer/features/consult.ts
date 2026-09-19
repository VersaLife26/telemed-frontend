export function shouldEnterCall(joinStatus?: string, consultStatus?: string): boolean {
  return joinStatus === "active" || consultStatus === "active";
}

export function callPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/call`;
}

export function joinPath(appointmentId: string): string {
  return `/consultations/${appointmentId}/join`;
}

export function noShowPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/no-show`;
}

export function readyForNextPath(appointmentId?: string): string {
  return appointmentId
    ? `/consultations/${appointmentId}/ready-for-next`
    : `/consultations/ready-for-next`;
}

export function earlyJoinPath(appointmentId: string): string {
  return `/consultations/${appointmentId}/early-join`;
}

export function earlyJoinRespondPath(appointmentId: string, kind: "accept" | "decline"): string {
  return `/consultations/${appointmentId}/early-join/${kind}`;
}

export function waitingRoomPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/waiting-room`;
}

export function waitingRoomPollPath(consultationId: string): string {
  return `/consultations/${consultationId}/waiting-room`;
}

export function admitPath(consultationId: string): string {
  return `/consultations/${consultationId}/admit`;
}

export function endPath(consultationId: string): string {
  return `/consultations/${consultationId}/end`;
}

export function isWaiting(status?: string, joinStatus?: string): boolean {
  return status === "scheduled" || status === "waiting" || joinStatus === "waiting";
}

export function shouldConnectMedia(joinStatus?: string, status?: string): boolean {
  return joinStatus === "active" || status === "active";
}

export function canAdmit(role: string, status?: string, joinStatus?: string): boolean {
  return role === "doctor" && isWaiting(status, joinStatus) && status !== "active" && status !== "scheduled";
}

export function admitDisabled(status?: string): boolean {
  return status === "scheduled";
}

/** Copy on the doctor Meet lobby. Only “waiting room” when the patient has joined. */
export function doctorLobbyCopy(status?: string): string {
  if (status === "waiting") {
    return "Patient is in the waiting room.";
  }
  return "Waiting for the patient to join. The booked slot is the visit window.";
}

export function consultJoinError(error: string, role: "patient" | "doctor" = "patient"): string {
  if (/not in a state that allows this action/i.test(error)) {
    return role === "doctor"
      ? "This visit isn’t open. The patient hasn’t joined yet, or it has already ended."
      : "This visit isn’t open yet, or it has already ended. Join from Appointments when it is time.";
  }
  return error;
}

/** Fallback slot length when end_at is unknown. Matches consultation DefaultBookedSlot. */
export const DEFAULT_SLOT_MS = 15 * 60 * 1000;
export const LATE_JOIN_GRACE_MS = DEFAULT_SLOT_MS;
export const LATE_JOIN_CUTOFF_MS = DEFAULT_SLOT_MS;

export function slotEndMs(startAt?: string, endAt?: string): number | null {
  if (endAt) {
    const end = Date.parse(endAt);
    if (Number.isFinite(end)) return end;
  }
  if (!startAt) return null;
  const start = Date.parse(startAt);
  if (!Number.isFinite(start)) return null;
  return start + DEFAULT_SLOT_MS;
}

export function minutesLate(startAt?: string, now = Date.now()): number {
  if (!startAt) return 0;
  const start = Date.parse(startAt);
  if (!Number.isFinite(start) || start >= now) return 0;
  return Math.floor((now - start) / 60_000);
}

export function isWithinLateJoinGrace(startAt?: string, now = Date.now(), endAt?: string): boolean {
  if (!startAt) return false;
  const start = Date.parse(startAt);
  const end = slotEndMs(startAt, endAt);
  if (!Number.isFinite(start) || end == null) return false;
  return now >= start && now < end;
}

export function isPastLateJoinCutoff(startAt?: string, now = Date.now(), endAt?: string): boolean {
  const end = slotEndMs(startAt, endAt);
  if (end == null) return false;
  return now >= end;
}

/** Patients may enter the lobby this long before the booked start. */
export const JOIN_WINDOW_BEFORE_MS = 15 * 60 * 1000;

export function joinWindowStartMs(startAt?: string): number | null {
  if (!startAt) return null;
  const start = Date.parse(startAt);
  if (!Number.isFinite(start)) return null;
  return start - JOIN_WINDOW_BEFORE_MS;
}

export function isBeforeJoinWindow(startAt?: string, now = Date.now()): boolean {
  const open = joinWindowStartMs(startAt);
  if (open == null) return false;
  return now < open;
}

export function isJoinWindow(startAt?: string, endAt?: string, now = Date.now()): boolean {
  if (isBeforeJoinWindow(startAt, now)) return false;
  if (isPastLateJoinCutoff(startAt, now, endAt)) return false;
  return joinWindowStartMs(startAt) != null;
}

/**
 * Doctors do not mark no-show. The booked slot is the visit window whether
 * the patient is late, on time, or never joins.
 */
export function canMarkNoShow(
  _role?: string,
  _status?: string,
  _startAt?: string,
  _now = Date.now(),
): boolean {
  return false;
}

export function endConsultBody() {
  return { reason: "completed" as const };
}

export function afterEndPath(role: "patient" | "doctor", appointmentId: string): string {
  return role === "doctor"
    ? `/appointments/${appointmentId}/clinical-notes`
    : `/appointments/${appointmentId}/summary`;
}

// --- in-house WebRTC --------------------------------------------------------

/**
 * Builds the signalling websocket URL for a join.
 *
 * This one deliberately does NOT go through /api/proxy. A Next route handler
 * cannot proxy a websocket upgrade, so the browser connects to the backend
 * directly -- which means signal_url has to be an address the user's device
 * can actually reach, and is why the backend refuses to boot in production
 * without an absolute wss:// value for it.
 *
 * Returns null when the deployment is not running the in-house stack, so the
 * caller can say so rather than opening a socket to "undefined".
 */
export function signalUrlFor(join: {
  signal_url?: string;
  token: string;
}): string | null {
  if (!join.signal_url) return null;
  return `${join.signal_url}?token=${encodeURIComponent(join.token)}`;
}

export function qualityPath(consultationId: string): string {
  return `/consultations/${consultationId}/quality`;
}

/**
 * The closed set the backend accepts. Sending anything else is a 422, so the
 * mapping below is the whole contract.
 */
export type QualityLabel = "excellent" | "good" | "poor" | "lost";

/**
 * Reduces a getStats sample to the label the backend grades on.
 *
 * The thresholds mirror peer.ts's own congestion detection so the server's
 * view and the client's bitrate ladder do not disagree about what "poor"
 * means -- QualityDegradeThreshold counts consecutive poor/lost reports, and
 * two definitions would make that count measure nothing.
 *
 * "lost" is not a bad connection, it is no connection: no round-trip time
 * measured at all means there is no candidate pair working.
 */
export function qualityLabel(sample: {
  rttMs: number | null;
  packetLoss: number;
}): QualityLabel {
  if (sample.rttMs === null) return "lost";
  if (sample.packetLoss >= 0.05 || sample.rttMs >= 400) return "poor";
  if (sample.packetLoss <= 0.01 && sample.rttMs <= 200) return "excellent";
  return "good";
}

/**
 * How often a quality sample is reported to the server.
 *
 * peer.ts samples getStats every 2s for its own bitrate ladder, which is the
 * right cadence for adapting an encoder and far too chatty for a database
 * write per sample per participant. Thirty seconds is enough for the server's
 * consecutive-poor counter to mean something without turning a consultation
 * into 60 writes a minute.
 */
export const QUALITY_REPORT_INTERVAL_MS = 30_000;
