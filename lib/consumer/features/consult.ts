import { hasCode } from "@/lib/consumer/api/errors";
import { API_BASE_URL } from "@/lib/consumer/env";

export function shouldEnterCall(joinStatus?: string, consultStatus?: string): boolean {
  return joinStatus === "active" || consultStatus === "active";
}

/** Consultation has finished; media must not restart. */
export function isConsultTerminal(status?: string): boolean {
  return status === "ended" || status === "abandoned";
}

export function callPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/call`;
}

function consultationBase(appointmentId: string): string {
  return `/appointments/${appointmentId}/consultation`;
}

export function joinPath(appointmentId: string): string {
  return `${consultationBase(appointmentId)}/join`;
}

export function consultationPath(appointmentId: string): string {
  return consultationBase(appointmentId);
}

export function noShowPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/no-show`;
}

export function readyForNextPath(appointmentId: string): string {
  return `${consultationBase(appointmentId)}/ready-for-next`;
}

export function earlyJoinPath(appointmentId: string): string {
  return `${consultationBase(appointmentId)}/early-join`;
}

export function earlyJoinRespondPath(appointmentId: string, kind: "accept" | "decline"): string {
  return `${consultationBase(appointmentId)}/early-join/${kind}`;
}

/** The app's own waiting-room route (redirects to the call screen). */
export function waitingRoomPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/waiting-room`;
}

export function waitingRoomPollPath(appointmentId: string): string {
  return `${consultationBase(appointmentId)}/waiting-room`;
}

export function admitPath(appointmentId: string): string {
  return `${consultationBase(appointmentId)}/admit`;
}

export function endPath(appointmentId: string): string {
  return `${consultationBase(appointmentId)}/end`;
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

const CLOSED_JOIN_CODES = ["too_early", "join_window_closed", "consultation_ended", "not_confirmed"];

export function consultJoinError(error: unknown, role: "patient" | "doctor" = "patient"): string {
  if (CLOSED_JOIN_CODES.some((code) => hasCode(error, code))) {
    return role === "doctor"
      ? "This visit isn’t open yet, or it has already ended."
      : "This visit isn’t open yet, or it has already ended. Join from Appointments when it is time.";
  }
  return error instanceof Error ? error.message : "Join failed";
}

/** Fallback slot length when the end time is unknown. */
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
 * Builds the signalling hub URL for a join.
 *
 * This one deliberately does NOT go through /api/proxy. A Next route handler
 * cannot proxy a websocket, so the browser connects to the API directly --
 * which means NEXT_PUBLIC_API_BASE_URL has to be an address the user's device
 * can reach, and the API has to allow this site's origin in Cors:Origins.
 * `hubUrl` comes back relative to the API origin (`/hubs/consultation`).
 */
export function hubUrlFor(
  join: { hubUrl: string; roomToken: string },
  apiBase: string = API_BASE_URL,
): string {
  const url = new URL(join.hubUrl, `${apiBase}/`);
  url.searchParams.set("roomToken", join.roomToken);
  return url.toString();
}

export function qualityPath(appointmentId: string): string {
  return `${consultationBase(appointmentId)}/quality`;
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
