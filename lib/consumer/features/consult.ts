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

/** Matches consultation-service LateJoinGrace / LateJoinCutoff. */
export const LATE_JOIN_GRACE_MS = 10 * 60 * 1000;
export const LATE_JOIN_CUTOFF_MS = LATE_JOIN_GRACE_MS;

export function minutesLate(startAt?: string, now = Date.now()): number {
  if (!startAt) return 0;
  const start = Date.parse(startAt);
  if (!Number.isFinite(start) || start >= now) return 0;
  return Math.floor((now - start) / 60_000);
}

export function isWithinLateJoinGrace(startAt?: string, now = Date.now()): boolean {
  if (!startAt) return false;
  const start = Date.parse(startAt);
  if (!Number.isFinite(start)) return false;
  return now >= start && now < start + LATE_JOIN_GRACE_MS;
}

export function isPastLateJoinCutoff(startAt?: string, now = Date.now()): boolean {
  if (!startAt) return false;
  const start = Date.parse(startAt);
  if (!Number.isFinite(start)) return false;
  return now >= start + LATE_JOIN_CUTOFF_MS;
}

/**
 * Doctor can mark no-show while the visit is still waiting for a first
 * patient join (consult `scheduled`, or queue `confirmed`) and start is past.
 */
export function canMarkNoShow(
  role: string,
  status?: string,
  startAt?: string,
  now = Date.now(),
): boolean {
  if (role !== "doctor") return false;
  if (
    status === "waiting" ||
    status === "active" ||
    status === "ended" ||
    status === "abandoned" ||
    status === "no_show" ||
    status === "cancelled" ||
    status === "completed"
  ) {
    return false;
  }
  if (!startAt) return false;
  const start = Date.parse(startAt);
  if (!Number.isFinite(start)) return false;
  return start < now;
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
