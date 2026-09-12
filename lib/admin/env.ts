import "server-only";

import { z } from "zod";

/**
 * Server environment parsing.
 *
 * `import "server-only"` is the point of this file, not decoration. The
 * browser-visible half lives in `lib/env.client.ts`; when both halves shared a
 * module, importing `clientEnv` from a client component shipped this schema —
 * every secret's *name*, and the internal gateway URL — into the browser
 * bundle. See the note at the top of `lib/env.client.ts`.
 */

const durationSeconds = z.coerce.number().int().positive();

const serverSchema = z.object({
  /**
   * Base URL of the API gateway (telemed-api-gateway, port 8080). The browser
   * never sees this: every call is proxied through the BFF route handler at
   * /api/gateway, which attaches the caller's Cloudflare Access token
   * server-side.
   */
  TELEMED_API_URL: z.url().default("http://localhost:8080"),

  /*
   * AUTH_SECRET and the AUTH_KEYCLOAK_* trio are gone with NextAuth. The
   * console has no sign-in of its own: Cloudflare Access authenticates
   * admin.versalifehealth.com at the edge and this application reads the JWT
   * it puts on the request.
   */

  /**
   * Idle window before the console sends the browser to Access's logout, in
   * seconds.
   *
   * NOT a session ceiling any more, and the rename is the honest part: there
   * is no server-side session here to cap. The Access application's own
   * session duration is the only server-side bound. This is the client-side
   * idle timer in components/admin/session/session-guard.tsx.
   */
  ADMIN_SESSION_MAX_AGE: durationSeconds.default(900),

  /** Upstream request timeout in milliseconds. */
  TELEMED_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})
  /**
   * Transport.
   *
   * `TELEMED_API_URL` is held to a weaker rule than an internet-facing URL. In-cluster it is a
   * plaintext service address (`http://api-gateway:8080`) because the mesh has
   * no mTLS today (platform review F29), and it is not this console's place to
   * refuse to boot over that. What it can refuse is plaintext to a *routable*
   * host, which is a different mistake with a different blast radius.
   */
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;

    const api = new URL(env.TELEMED_API_URL);
    if (api.protocol !== "https:" && !isClusterLocalHost(api.hostname)) {
      ctx.addIssue({
        code: "custom",
        path: ["TELEMED_API_URL"],
        message:
          "must be https:// in production unless it names a cluster-local or loopback host",
      });
    }
  });

/**
 * A hostname that cannot be reached from outside the cluster: a bare service
 * name, a `.local`/`.internal`/`.svc` suffix, or loopback.
 */
function isClusterLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    return true;
  }
  if (!host.includes(".")) return true;
  return (
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".svc") ||
    host.endsWith(".svc.cluster.local")
  );
}

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedServerEnv: ServerEnv | null = null;

/**
 * Parses and caches server environment. Throws with every failing variable
 * listed at once — an operator fixing a misconfigured deployment should not
 * have to discover the missing variables one restart at a time.
 */
export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${detail}`);
  }
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}
