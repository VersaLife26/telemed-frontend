import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import type { JWT } from "next-auth/jwt";

import { SESSION_MAX_AGE_SECONDS, authConfig } from "./auth.config";
import {
  adminRolesFrom,
  decodeAccessToken,
  satisfiedSecondFactor,
  twoFactorRequired,
} from "./lib/admin/auth/claims";

/**
 * Auth.js v5 with the Keycloak provider.
 *
 * Three things happen here that are not boilerplate:
 *
 * 1. **The 2FA gate.** Keycloak enforces TOTP in its browser flow, but a realm
 *    misconfiguration would silently let a password-only login through. The
 *    `signIn` callback re-checks the resulting token's `amr`/`acr` claims and
 *    refuses the session if the second factor is missing. Defence in depth,
 *    and it fails closed.
 *
 * 2. **Transparent refresh.** The `jwt` callback refreshes the Keycloak access
 *    token a minute before it expires, using the refresh token, so a long
 *    verification review is never interrupted by a 401 mid-approval.
 *
 * 3. **Roles come from the token, never from the session.** `adminRolesFrom`
 *    reads `realm_access.roles` off the freshly issued access token on every
 *    refresh. Revoking someone's `finance` role in Keycloak takes effect on
 *    the next refresh rather than at their next login.
 *
 * The access token itself is never exposed to the browser. It lives in the
 * encrypted Auth.js JWT cookie and is attached server-side by the BFF proxy in
 * app/api/gateway/[...path]/route.ts.
 */

/** Refresh this many milliseconds before the access token actually expires. */
const REFRESH_SKEW_MS = 60_000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Keycloak({
      // Client id, secret and issuer are read from AUTH_KEYCLOAK_ID,
      // AUTH_KEYCLOAK_SECRET and AUTH_KEYCLOAK_ISSUER by Auth.js convention,
      // which keeps this file free of process.env reads at module scope and
      // therefore safe to evaluate during `next build` with no .env present.
      authorization: {
        params: {
          scope: "openid profile email telemed",
          // Ask Keycloak for the 2FA level of assurance. Realms that use the
          // acr-to-loa mapping honour this; realms that enforce OTP in the
          // browser flow ignore it harmlessly and report `amr` instead.
          acr_values: process.env.AUTH_ACR_2FA ?? "2fa",
          // Ignore an existing Keycloak SSO cookie. Cookie success is an
          // ALTERNATIVE at the top of the browser flow, so a previous
          // password-only (or cookie) session would skip OTP and the token
          // would carry acr=1 / empty amr — which this console then refuses.
          prompt: "login",
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ account }) {
      if (!account?.access_token) return false;

      const claims = decodeAccessToken(account.access_token);

      // An admin console login by someone with no admin role is not a
      // partially-useful session; it is a login that should not have happened.
      if (adminRolesFrom(claims).length === 0) return false;

      if (twoFactorRequired() && !satisfiedSecondFactor(claims)) {
        // Surfaced as ?error=AccessDenied on /login, where the page explains
        // that TOTP enrolment is required rather than showing "sign-in failed".
        console.error("admin sign-in refused: second factor missing", {
          acr: claims?.acr,
          amr: claims?.amr,
          roles: claims?.realm_access?.roles,
        });
        return false;
      }
      return true;
    },

    async jwt({ token, account }) {
      // --- initial sign-in -------------------------------------------------
      if (account?.access_token) {
        return applyAccessToken(token, {
          accessToken: account.access_token,
          refreshToken: typeof account.refresh_token === "string" ? account.refresh_token : undefined,
          idToken: typeof account.id_token === "string" ? account.id_token : undefined,
          expiresAtSeconds: typeof account.expires_at === "number" ? account.expires_at : undefined,
        });
      }

      // --- still valid -----------------------------------------------------
      const expiresAt = token.accessTokenExpiresAt ?? 0;
      if (expiresAt - REFRESH_SKEW_MS > Date.now()) {
        return token;
      }

      // --- refresh ---------------------------------------------------------
      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      session.roles = token.roles ?? [];
      session.expiresAt = Date.parse(session.expires);
      if (token.error) session.error = token.error;
      if (token.subject) session.user.id = token.subject;
      return session;
    },
  },

  events: {
    async signOut(message) {
      // Best-effort Keycloak back-channel logout. A failure here must not
      // block the local sign-out, which has already happened by this point.
      const idToken = "token" in message ? message.token?.idToken : undefined;
      const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
      if (!idToken || !issuer) return;
      try {
        const url = new URL(`${issuer.replace(/\/$/, "")}/protocol/openid-connect/logout`);
        url.searchParams.set("id_token_hint", idToken);
        await fetch(url, { method: "GET" });
      } catch {
        // Deliberately swallowed: the local session is already gone.
      }
    },
  },
});

/** Copies a freshly issued token set onto the Auth.js JWT. */
function applyAccessToken(
  token: JWT,
  issued: {
    accessToken: string;
    refreshToken?: string | undefined;
    idToken?: string | undefined;
    expiresAtSeconds?: number | undefined;
  },
): JWT {
  const claims = decodeAccessToken(issued.accessToken);
  const expiresAtMs = issued.expiresAtSeconds
    ? issued.expiresAtSeconds * 1000
    : claims?.exp
      ? claims.exp * 1000
      : Date.now() + SESSION_MAX_AGE_SECONDS * 1000;

  const next: JWT = {
    ...token,
    accessToken: issued.accessToken,
    accessTokenExpiresAt: expiresAtMs,
    roles: adminRolesFrom(claims),
  };
  if (issued.refreshToken) next.refreshToken = issued.refreshToken;
  if (issued.idToken) next.idToken = issued.idToken;
  if (claims?.sub) next.subject = claims.sub;
  delete next.error;
  return next;
}

/**
 * Exchanges the refresh token for a new access token at Keycloak's token
 * endpoint. On failure the JWT is marked `RefreshFailed` and the access token
 * dropped, so the BFF proxy refuses to call the gateway with a stale token
 * rather than producing a confusing 401 halfway through a form submission.
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
  const clientId = process.env.AUTH_KEYCLOAK_ID;
  const clientSecret = process.env.AUTH_KEYCLOAK_SECRET;

  if (!token.refreshToken || !issuer || !clientId || !clientSecret) {
    return expire(token);
  }

  try {
    const response = await fetch(
      `${issuer.replace(/\/$/, "")}/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: token.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      },
    );

    if (!response.ok) return expire(token);

    const body = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      expires_in?: number;
    };
    if (!body.access_token) return expire(token);

    return applyAccessToken(token, {
      accessToken: body.access_token,
      // Keycloak rotates refresh tokens by default; keep the new one when it
      // sends one, fall back to the existing one when it does not.
      refreshToken: body.refresh_token ?? token.refreshToken,
      idToken: body.id_token ?? token.idToken,
      expiresAtSeconds: body.expires_in
        ? Math.floor(Date.now() / 1000) + body.expires_in
        : undefined,
    });
  } catch {
    return expire(token);
  }
}

function expire(token: JWT): JWT {
  const next: JWT = { ...token, error: "RefreshFailed" };
  delete next.accessToken;
  delete next.accessTokenExpiresAt;
  return next;
}
