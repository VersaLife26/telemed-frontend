/**
 * Content Security Policy for the admin console.
 *
 * The policy is defined once, here, and emitted from two places that never
 * overlap:
 *
 *   - `proxy.ts` emits the nonce-bearing policy for every HTML/RSC
 *     response. App Router injects inline <script> tags carrying the Flight
 *     payload, so a nonce (or `'unsafe-inline'`, which defeats the point) is
 *     unavoidable. `'strict-dynamic'` then lets those nonce-approved scripts
 *     load the chunk graph without us enumerating hashes.
 *   - `next.config.ts` emits the nonce-free policy for the static asset paths
 *     the middleware matcher deliberately skips (`/_next/static`,
 *     `/_next/image`, `favicon.ico`). Those responses are never HTML, so a
 *     bare `script-src 'self'` is both sufficient and strictly tighter.
 *
 * Splitting it this way means no route ever receives two CSP headers, which
 * browsers intersect — an intersection that in practice silently breaks the
 * app while looking, in DevTools, like it should work.
 */

/**
 * Origins the document viewer is allowed to pull doctor credential scans
 * from. MinIO presigned URLs point at the object store directly, so that
 * origin has to be named; nothing else is.
 */
function storageOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_STORAGE_ORIGINS ?? "";
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Keycloak's public origin. The login form POSTs to this console, then Auth.js
 * 303s the browser to the issuer's authorize URL. CSP `form-action` applies to
 * that redirect target as well as the form's action — `'self'` alone makes the
 * SSO button look dead (POST succeeds, navigation is blocked).
 */
function keycloakOrigin(): string | undefined {
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
  if (!issuer) return undefined;
  try {
    return new URL(issuer).origin;
  } catch {
    return undefined;
  }
}

export interface CspOptions {
  /** Nonce to authorise Next.js' own inline bootstrap scripts. */
  nonce?: string;
  /**
   * Development needs `'unsafe-eval'`: Turbopack's HMR runtime evaluates
   * module code at runtime. Production must never get it.
   */
  dev?: boolean;
}

/** Builds the policy string. */
export function contentSecurityPolicy({ nonce, dev = false }: CspOptions = {}): string {
  const storage = storageOrigins();
  const keycloak = keycloakOrigin();

  const scriptSrc = nonce
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])]
    : ["'self'", ...(dev ? ["'unsafe-eval'"] : [])];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    // Tailwind emits a stylesheet, but Recharts and Radix both set inline
    // `style` attributes for positioning. `style-src-attr 'unsafe-inline'`
    // permits exactly that while `style-src` still refuses inline <style>
    // blocks from an injected payload.
    "style-src": ["'self'"],
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", ...storage],
    "font-src": ["'self'", "data:"],
    // The browser talks to this origin only. Every backend call is proxied by
    // the BFF route handler, which is what keeps the Keycloak access token
    // out of the browser entirely.
    "connect-src": ["'self'", ...(dev ? ["ws:", "wss:"] : [])],
    // PDF credential scans render in a sandboxed <iframe> pointed at a
    // presigned storage URL.
    "frame-src": ["'self'", ...storage],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // See keycloakOrigin(): Auth.js SSO is a same-origin POST that 303s to
    // the issuer. Without the issuer origin here, Chrome blocks the redirect.
    "form-action": ["'self'", ...(keycloak ? [keycloak] : [])],
    "frame-ancestors": ["'none'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };

  const parts = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.join(" ")}`,
  );
  if (!dev) {
    parts.push("upgrade-insecure-requests");
  }
  return parts.join("; ");
}

/**
 * Security headers that are identical on every response and carry no nonce.
 * `next.config.ts` applies these globally; the middleware does not repeat
 * them.
 */
export const staticSecurityHeaders: ReadonlyArray<{ key: string; value: string }> = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    // The admin console has no legitimate use for any of these. The patient
    // and doctor apps need camera and microphone; this one never does, and
    // saying so is free.
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "usb=()",
    ].join(", "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];
