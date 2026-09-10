import type { NextAuthConfig } from "next-auth";

/**
 * Configuration shared by the full Auth.js instance (`auth.ts`) and anything
 * that must stay lightweight. Providers are added in `auth.ts` only.
 *
 * Session length: the V2 docs mandate 15 minutes on the admin surface. That
 * number is the JWT `maxAge`, and because Auth.js re-issues the session cookie
 * on activity, it behaves as an idle timeout — 15 minutes of *inactivity*
 * ends the session, continuous work does not. `components/session/` renders
 * the countdown against the same deadline.
 */

const sessionMaxAge = readPositiveInt(process.env.ADMIN_SESSION_MAX_AGE, 900);

export const SESSION_MAX_AGE_SECONDS = sessionMaxAge;

/**
 * The session cookie name.
 *
 * `__Host-` in production is load-bearing, not cosmetic: the prefix makes the
 * browser refuse the cookie unless it is `Secure`, `Path=/` and carries **no
 * `Domain`**. That last part is what stops a compromised or hostile sibling
 * subdomain — anything under `*.yourapp.lk` — from writing a session cookie
 * that this console would then read.
 *
 * Exported because `getToken()` derives its HKDF salt from the cookie name by
 * default: the BFF proxy has to pass the exact same string or the JWT it reads
 * back will not decrypt.
 *
 * Taken as an argument rather than read from the environment inline so the
 * production branch is reachable from a test.
 */
export function sessionCookieName(isProduction: boolean): string {
  return isProduction ? "__Host-telemed-admin.session" : "telemed-admin.session";
}

export const SESSION_COOKIE_NAME = sessionCookieName(
  process.env.NODE_ENV === "production",
);

/**
 * Session cookie attributes.
 *
 * `httpOnly` is the reason an XSS on this console cannot read the session at
 * all: the Keycloak access token lives inside this cookie, encrypted, and is
 * only ever unwrapped server-side by the BFF. There is no code path that puts
 * a token in `localStorage`, in `sessionStorage`, or on `window`.
 *
 * `sameSite: "lax"` rather than `"strict"` because the Keycloak sign-in
 * redirect returns as a top-level GET navigation from another origin, which
 * `strict` would strip the cookie from. Lax still refuses to attach the cookie
 * to a cross-site POST, so a cross-site state change against `/api/gateway/*`
 * arrives with no session at all — and `sameOriginRequest` in
 * `lib/api/upstream.ts` refuses it a second time.
 */
export function sessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isProduction,
  };
}

export const authConfig = {
  providers: [],

  callbacks: {
    /**
     * Copies the decoded token onto the session.
     *
     * Lives HERE and not in auth.ts because the admin proxy needs it. The
     * proxy runs on the edge runtime and must not pull in the full Auth.js
     * instance -- that drags the Keycloak provider and the token-refresh
     * fetch into every request that renders a page. The canonical Auth.js v5
     * split is exactly this: a lightweight config the middleware can build an
     * instance from, and a full one for the route handler.
     *
     * It is pure. It reads the already-decoded JWT and writes to the session,
     * touching no network and no Node API. The `jwt` callback that PUTS roles
     * on the token stays in auth.ts, because it only runs at sign-in and
     * refresh -- by the time the proxy reads a session, the roles are already
     * in the cookie.
     */
    async session({ session, token }) {
      session.roles = token.roles ?? [];
      session.expiresAt = Date.parse(session.expires);
      if (token.error) session.error = token.error;
      if (token.subject) session.user.id = token.subject;
      return session;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: sessionMaxAge,
    // Re-issue the cookie at most once a minute. Without this Auth.js only
    // rolls the session every 24h by default, and the "idle timeout" would
    // silently become an absolute one that logs out an admin mid-task.
    updateAge: 60,
  },

  jwt: {
    maxAge: sessionMaxAge,
  },

  pages: {
    signIn: "/login",
    error: "/login",
    signOut: "/login",
  },

  /**
   * Applies `Secure` and the `__Secure-`/`__Host-` prefixes to **every** Auth.js
   * cookie, not just the session one.
   *
   * Without this, Auth.js decides per-cookie from whether the resolved origin
   * is https. `cookies.sessionToken` below hardcodes `__Host-` + `Secure` in
   * production, so the two halves of the cookie jar could disagree: a
   * deployment whose `AUTH_URL` is `http://…`, or one behind a proxy that does
   * not set `X-Forwarded-Proto`, would get a `Secure` session cookie alongside
   * a plaintext `csrf-token`, `pkce.code_verifier` and `state`. Those three
   * are the OAuth flow's integrity, and a cookie without `Secure` can be
   * overwritten by anyone who can MITM *any* http origin on the parent domain.
   *
   * Setting it explicitly also means a production deployment served over plain
   * http cannot sign anyone in at all, which for this console is the answer.
   */
  useSecureCookies: process.env.NODE_ENV === "production",

  cookies: {
    sessionToken: {
      name: SESSION_COOKIE_NAME,
      options: sessionCookieOptions(process.env.NODE_ENV === "production"),
    },
  },

  trustHost: true,
} satisfies NextAuthConfig;

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
