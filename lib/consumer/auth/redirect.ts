/** Same-origin post-login path only; rejects protocol-relative and off-origin targets. */
const SENTINEL = "https://patient.invalid";

export function safeNextPath(raw: string | undefined | null): string {
  if (!raw) return "/home";
  if (!raw.startsWith("/")) return "/home";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return "/home";

  let url: URL;
  try {
    url = new URL(raw, SENTINEL);
  } catch {
    return "/home";
  }
  if (url.origin !== SENTINEL) return "/home";

  const path = `${url.pathname}${url.search}${url.hash}`;
  return path.startsWith("/") && !path.startsWith("//") ? path : "/home";
}
