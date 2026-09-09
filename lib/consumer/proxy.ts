export function gatewayUrl(apiBase: string, pathSegments: string[], search = ""): string {
  const base = apiBase.replace(/\/$/, "");
  const suffix = pathSegments.map(encodeURIComponent).join("/");
  return `${base}/api/v1/${suffix}${search}`;
}

export function shouldForwardBody(method: string): boolean {
  const m = method.toUpperCase();
  return m !== "GET" && m !== "HEAD";
}

/** HTTP statuses that must not carry a body (Fetch / undici reject one). */
export function isNullBodyStatus(status: number): boolean {
  return status === 204 || status === 205 || status === 304;
}
