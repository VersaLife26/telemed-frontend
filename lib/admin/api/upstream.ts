/**
 * Pure request-shaping logic for the BFF proxy.
 *
 * Deliberately free of `server-only`, of `next/*` and of every environment
 * read, so it can be exercised directly by `npm test`. Everything in here is a
 * decision the proxy makes *before* it attaches an admin bearer token to an
 * outbound request, which is exactly the code that should be under test.
 */

/** The one upstream prefix this console is permitted to reach. */
export const ADMIN_PATH_PREFIX = "api/v1/admin";

/**
 * Characters a path segment may contain after Next.js has URL-decoded it.
 *
 * Every real admin path is built from UUIDs, lower-case words, hyphens,
 * underscores and the occasional `.csv`. Refusing everything else removes, in
 * one predicate, the whole class of tricks that turn a path join into an
 * unintended request: `/` and `\` (traversal and segment splicing), `?` and `#`
 * (query/fragment smuggling into what the caller believes is a path), `%`
 * (double encoding), `:` and `@` (authority confusion), whitespace, and CR/LF.
 */
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * Validates the catch-all segments of `/api/gateway/[...path]` and returns the
 * upstream path to call, or `null` to refuse.
 *
 * The check this replaces was:
 *
 *     if (!upstreamPath.startsWith(ADMIN_PATH_PREFIX) || upstreamPath.includes(".."))
 *
 * `startsWith` on a joined string is not a path-boundary check: `api/v1/admins`
 * and `api/v1/administration` both satisfy it, so any upstream route whose name
 * merely *begins* with `admin` was reachable through a proxy documented as
 * carrying only `/api/v1/admin/*`. And `includes("..")` is a substring test on
 * a value that has already been decoded once, so it both over-matches (a
 * legitimate `foo..bar` segment) and reasons about the wrong thing (the
 * question is whether a segment *is* `..`, not whether one contains it).
 *
 * This version compares segment by segment, so the boundary is structural.
 */
export function adminUpstreamPath(segments: readonly string[]): string | null {
  // api / v1 / admin / <at least one more>
  if (segments.length < 4) return null;
  if (segments[0] !== "api" || segments[1] !== "v1" || segments[2] !== "admin") {
    return null;
  }
  for (const segment of segments) {
    if (segment === "." || segment === "..") return null;
    if (!SAFE_SEGMENT.test(segment)) return null;
  }
  return segments.join("/");
}

/**
 * Is this a same-origin request from the console's own pages?
 *
 * The session cookie is `SameSite=Lax`, which already stops a cross-site form
 * POST from carrying it. This is the second layer, and it is cheap: browsers
 * send `Origin` on every request whose method is not GET/HEAD, and
 * `Sec-Fetch-Site` on every request full stop. A mutating call to the BFF that
 * carries neither did not come from a page of this console.
 *
 * GET is exempt because a top-level navigation to a proxied read carries
 * `Sec-Fetch-Site: none` and no `Origin`, and refusing that would break
 * nothing an attacker cares about while breaking the CSV download.
 */
export function sameOriginRequest(
  method: string,
  headers: Headers,
  expectedOrigin: string,
): boolean {
  if (method === "GET" || method === "HEAD") return true;

  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return false;

  const origin = headers.get("origin");
  if (origin !== null) return origin === expectedOrigin;

  // No Origin and no Sec-Fetch-Site: not a browser we recognise. `fetch` from
  // the console always produces at least one of the two.
  return site === "same-origin";
}

// ---------------------------------------------------------------------------
// Client address
// ---------------------------------------------------------------------------

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
// Deliberately permissive on IPv6 *shape* and strict on its alphabet: anything
// that is not hex, colon or a trailing IPv4 tail cannot be an address, and that
// is the property that matters when the value is about to be put in a header.
const IPV6 = /^[0-9A-Fa-f:]{2,45}$/;

function normaliseAddress(raw: string): string | null {
  let value = raw.trim();
  if (value === "") return null;
  // `[2001:db8::1]:443` and `203.0.113.5:443` both appear in the wild.
  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close === -1) return null;
    value = value.slice(1, close);
  } else if ((value.match(/:/g) ?? []).length === 1) {
    value = value.slice(0, value.indexOf(":"));
  }
  if (IPV4.test(value)) return value;
  if (value.includes(":") && IPV6.test(value)) return value;
  return null;
}

/**
 * The address the console believes the admin is calling from, or `null` when it
 * cannot tell.
 *
 * This decides what the gateway's `ADMIN_IP_ALLOWLIST` is evaluated against, so
 * getting it wrong is not a logging inconvenience — it is the network control.
 *
 * The rule: **believe the hop in front of us, never the caller.**
 *
 *  - `X-Real-IP` is written by ingress-nginx from `$remote_addr`, the TCP peer
 *    it actually observed. It carries exactly one value and a client cannot
 *    contribute to it, so it is preferred.
 *  - Otherwise the **rightmost** entry of `X-Forwarded-For` is taken. A proxy
 *    appends the address it saw to the right of the list; everything to its
 *    left is whatever the caller typed. Reading from the left — which is what
 *    the previous implementation did by forwarding the header verbatim — reads
 *    the caller's own claim.
 *  - If neither yields a parseable address, the answer is `null` and the proxy
 *    sends no forwarding header at all. The gateway then resolves the console
 *    pod's own address, which is not on the office/VPN allowlist, so the
 *    request is refused. Refusing an admin is a bad afternoon; admitting a
 *    stranger is a breach.
 *
 * Known limitation, stated rather than hidden: with a second L7 hop in front of
 * the ingress (a CDN), the rightmost entry is that hop's address rather than
 * the admin's, and every admin is refused until the ingress is configured to
 * append. That failure is loud and closed, which is the correct direction.
 */
export function clientAddress(headers: Headers): string | null {
  const real = headers.get("x-real-ip");
  if (real) {
    const parsed = normaliseAddress(real);
    if (parsed) return parsed;
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const parsed = normaliseAddress(parts[i] ?? "");
      if (parsed) return parsed;
    }
  }

  return null;
}

/**
 * Forwarding headers for an upstream call, or an empty object when the client
 * address is unknown.
 *
 * Both headers are *set*, never appended to, so no value chosen by the caller
 * survives the hop.
 */
export function forwardingHeaders(headers: Headers): Record<string, string> {
  const address = clientAddress(headers);
  if (address === null) return {};
  return { "X-Forwarded-For": address, "X-Real-IP": address };
}

// ---------------------------------------------------------------------------
// Response shaping
// ---------------------------------------------------------------------------

/**
 * Content types the proxy is willing to hand back with the upstream's own
 * label. Everything else is relabelled `application/octet-stream` and marked
 * as an attachment.
 *
 * The reason is that `/api/gateway/*` is same-origin with the console. A
 * top-level navigation to a proxied path is a GET, so it carries the
 * `SameSite=Lax` session cookie, and whatever the upstream returns is then
 * rendered *in the console's origin*. Admin API responses embed strings the
 * platform's own users wrote — a doctor's name, a dispute description — so an
 * upstream that ever answered `text/html` would be handing an attacker a
 * document on this origin. The CSP would still refuse to run script in it, but
 * a control that depends on a second control holding is not a control.
 */
const RENDERABLE_UPSTREAM_TYPES = [
  "application/json",
  "application/problem+json",
  "text/csv",
  "text/plain",
  "application/pdf",
];

export function safeContentType(raw: string | null): {
  contentType: string;
  attachment: boolean;
} {
  const value = (raw ?? "").trim().toLowerCase();
  const base = value.split(";")[0]?.trim() ?? "";
  if (RENDERABLE_UPSTREAM_TYPES.includes(base)) {
    return { contentType: raw ?? base, attachment: false };
  }
  return { contentType: "application/octet-stream", attachment: true };
}
