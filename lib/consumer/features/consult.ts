export function shouldEnterCall(joinStatus?: string, consultStatus?: string): boolean {
  return joinStatus === "active" || consultStatus === "active";
}

export function callPath(appointmentId: string): string {
  return `/appointments/${appointmentId}/call`;
}

export function joinPath(appointmentId: string): string {
  return `/consultations/${appointmentId}/join`;
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
