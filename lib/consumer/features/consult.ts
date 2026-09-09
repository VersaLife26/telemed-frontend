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
