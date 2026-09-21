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
    // the BFF route handler, which is what keeps a replayable bearer token out
    // of the browser entirely.
    "connect-src": ["'self'", ...(dev ? ["ws:", "wss:"] : [])],
    // PDF credential scans render in a sandboxed <iframe> pointed at a
    // presigned storage URL.
    "frame-src": ["'self'", ...storage],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // 'self' alone, now that the console has no SSO redirect of its own. The
    // identity provider's origin used to be listed here because Auth.js 303'd
    // the browser to Keycloak's authorize URL and form-action applies to the
    // redirect target. Cloudflare Access challenges before the request ever
    // reaches this Worker, so no response from here navigates to an IdP.
    "form-action": ["'self'"],
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
 * Permissions-Policy for this deployment.
 *
 * `camera=()` / `microphone=()` is a hard deny: the browser will not prompt,
 * it just rejects getUserMedia. That is correct for admin. Patient and doctor
 * calls must allow the same origin so the permission dialog can appear.
 */
export function permissionsPolicy(surface: string): string {
  const consult = surface === "patient" || surface === "doctor";
  const selfOrNone = consult ? "(self)" : "()";
  return [
    "accelerometer=()",
    `autoplay=${selfOrNone}`,
    `camera=${selfOrNone}`,
    `display-capture=${selfOrNone}`,
    "encrypted-media=()",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    `microphone=${selfOrNone}`,
    "midi=()",
    "payment=()",
    "usb=()",
  ].join(", ");
}

function deployedSurface(): string {
  return process.env.TELEMED_SURFACE ?? process.env.NEXT_PUBLIC_TELEMED_SURFACE ?? "patient";
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
    value: permissionsPolicy(deployedSurface()),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];
