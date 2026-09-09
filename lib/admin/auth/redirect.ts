/**
 * Post-sign-in redirect targets.
 *
 * `/login?next=…` is copied from the URL an admin was refused at, and is then
 * fed to `redirect()` and to `signIn({ redirectTo })`. Both will happily send
 * the browser wherever the string points, so the string has to be proved to be
 * a path on this console and nothing else.
 *
 * The check this replaces was `next.startsWith("/")`, which is the classic
 * near-miss: `//evil.example` starts with `/` and is a **protocol-relative
 * URL**, so `Location: //evil.example` navigates to `https://evil.example`.
 * `/\evil.example` is the same trick with a backslash, which the WHATWG URL
 * parser normalises to `/` for HTTP(S). The result is an open redirect on the
 * genuine admin host, reached before authentication — the cleanest possible
 * phishing vector against exactly the people who can approve doctors and move
 * money. (Recorded as F29 in the platform review; this is the fix.)
 *
 * Rather than enumerate the tricks, the target is resolved against a sentinel
 * origin and rejected unless it *stays* there. Anything that can change the
 * origin is by definition not a relative path.
 */

/** An origin no real deployment can be, so a match is proof of relativeness. */
const SENTINEL = "https://console.invalid";

export function safeNextPath(raw: string | undefined | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  // Control characters (CR, LF, NUL, tab) have no business in a Location value
  // and are how header splitting is attempted. The URL parser strips some of
  // them silently, which is exactly why they are refused before it runs.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return "/";

  let url: URL;
  try {
    url = new URL(raw, SENTINEL);
  } catch {
    return "/";
  }
  if (url.origin !== SENTINEL) return "/";

  const path = `${url.pathname}${url.search}${url.hash}`;
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}
