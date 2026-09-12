/**
 * Browser-visible configuration.
 *
 * Split out of `lib/env.ts` deliberately, and not merely into a different
 * object in the same file.
 *
 * `lib/env.ts` used to hold both halves and carried a comment saying that
 * "keeping them in a different object makes an accidental import obvious in
 * review". It does not. A client component importing `clientEnv` pulls in the
 * whole module, so the server schema shipped to the browser: the built bundle
 * contained, verbatim,
 *
 *   {TELEMED_API_URL:z.url().default("http://localhost:8080"),
 *    AUTH_SECRET:z.string().min(1,"AUTH_SECRET is required"),
 *    AUTH_KEYCLOAK_SECRET:z.string().min(1,"AUTH_KEYCLOAK_SECRET is required"), …}
 *
 * — an inventory of every secret the deployment held and the internal gateway
 * URL, handed to anyone who opened DevTools. (Those particular keys are gone
 * with NextAuth; the boundary this module draws is not.) No secret *value*
 * leaked, because those are read from `process.env` at runtime and the browser
 * has none; but the module boundary was the only thing standing between that
 * and a future `.default("…")` that does contain one, and there was no module
 * boundary.
 *
 * Now there is: `lib/env.ts` imports `server-only`, so importing it from a
 * client component is a build error rather than a bundle to audit.
 *
 * Values here are read as literal `process.env.NEXT_PUBLIC_*` expressions
 * because Next.js substitutes them at build time by textual match — a dynamic
 * lookup would be `undefined` in the bundle.
 */

export const clientEnv = {
  /**
   * Seconds of inactivity before the console signs the admin out locally.
   * Defaults to the same 15 minutes as the session ceiling.
   */
  idleTimeoutSeconds: toInt(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_SECONDS, 900),
  /** How long before expiry the visible countdown appears. */
  sessionWarningSeconds: toInt(process.env.NEXT_PUBLIC_SESSION_WARNING_SECONDS, 120),
  /** Shown in the header so nobody force-cancels an appointment in prod by mistake. */
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
} as const;

function toInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
