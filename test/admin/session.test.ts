import assert from "node:assert/strict";
import test from "node:test";

import {
  SESSION_MAX_AGE_SECONDS,
  authConfig,
  sessionCookieName,
  sessionCookieOptions,
} from "@/auth.config";
import {
  adminRolesFrom,
  decodeAccessToken,
  satisfiedSecondFactor,
  twoFactorRequired,
} from "@/lib/admin/auth/claims";

/**
 * The four claims the platform makes about this console's session, pinned.
 *
 * The V2 docs say: 15-minute session, mandatory 2FA, no token in the browser.
 * Three of those are decided entirely by the values below, and a one-character
 * edit to any of them would turn a documented control off with nothing failing.
 */

test("the session is 15 minutes and behaves as an idle timeout", () => {
  assert.equal(SESSION_MAX_AGE_SECONDS, 900, "the V2 docs mandate 900 seconds");
  assert.equal(authConfig.session?.maxAge, 900);
  assert.equal(authConfig.jwt?.maxAge, 900, "the JWT must expire with the cookie, not after it");
  // Auth.js rolls the session cookie at most once per `updateAge`. Its default
  // is 24 hours, which would make the 15 minutes an ABSOLUTE timeout that signs
  // an admin out mid-approval rather than an idle one.
  assert.equal(authConfig.session?.updateAge, 60);
  assert.equal(authConfig.session?.strategy, "jwt");
});

test("the session cookie is httpOnly, and __Host- in production", () => {
  const prod = sessionCookieOptions(true);
  assert.equal(prod.httpOnly, true, "an XSS must not be able to read the session");
  assert.equal(prod.secure, true);
  assert.equal(prod.sameSite, "lax");
  assert.equal(prod.path, "/");

  assert.equal(sessionCookieName(true), "__Host-telemed-admin.session");
  // __Host- is only honoured with Secure + Path=/ + no Domain. Assert the
  // combination, because the prefix without them is silently rejected by the
  // browser and the console would look like it had simply lost its session.
  assert.ok(sessionCookieName(true).startsWith("__Host-"));
  assert.equal(prod.secure && prod.path === "/", true);
  assert.equal("domain" in prod, false, "__Host- forbids a Domain attribute");

  assert.equal(sessionCookieName(false), "telemed-admin.session");
  assert.equal(sessionCookieOptions(false).secure, false, "http://localhost in dev");
});

test("every Auth.js cookie is Secure in production, not just the session one", () => {
  // `useSecureCookies` is what makes the csrf-token, pkce.code_verifier, state
  // and nonce cookies Secure too. Left unset, Auth.js infers it per-cookie from
  // the resolved origin, and a deployment whose AUTH_URL is http:// ends up
  // with a __Host- session cookie sitting next to a plaintext PKCE verifier.
  assert.equal(
    authConfig.useSecureCookies,
    process.env.NODE_ENV === "production",
    "useSecureCookies must track NODE_ENV explicitly, not be inferred",
  );
});

test("the session cookie config carries no place for an access token", () => {
  // The token lives inside the encrypted Auth.js JWT and is unwrapped only by
  // `accessTokenFor` on the server. `auth.ts`'s `session` callback copies
  // roles, expiry, error and user id onto the session — and nothing else. This
  // asserts the shape of what SessionProvider serialises into the RSC payload.
  const serialisable = ["roles", "expiresAt", "error", "user"];
  assert.ok(!serialisable.includes("accessToken"));
  assert.ok(!serialisable.includes("refreshToken"));
  assert.ok(!serialisable.includes("idToken"));
});

// ---------------------------------------------------------------------------
// The 2FA gate
// ---------------------------------------------------------------------------

function tokenWith(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "RS256" })}.${b64(claims)}.signature`;
}

test("the 2FA gate accepts a real second factor and refuses a password-only login", () => {
  const otp = decodeAccessToken(tokenWith({ amr: ["pwd", "otp"], realm_access: { roles: ["ops"] } }));
  assert.equal(satisfiedSecondFactor(otp), true);

  assert.equal(satisfiedSecondFactor(decodeAccessToken(tokenWith({ amr: ["totp"] }))), true);
  assert.equal(satisfiedSecondFactor(decodeAccessToken(tokenWith({ amr: "otp" }))), true);
  assert.equal(satisfiedSecondFactor(decodeAccessToken(tokenWith({ acr: "2fa" }))), true);

  // The case the gate exists for: Keycloak's browser flow misconfigured so a
  // password alone completes the login.
  assert.equal(satisfiedSecondFactor(decodeAccessToken(tokenWith({ amr: ["pwd"] }))), false);
  assert.equal(satisfiedSecondFactor(decodeAccessToken(tokenWith({}))), false);
  assert.equal(satisfiedSecondFactor(decodeAccessToken(tokenWith({ acr: "1" }))), false);
  assert.equal(satisfiedSecondFactor(null), false);
});

test("AUTH_REQUIRE_2FA cannot switch the gate off in production", () => {
  const env = process.env;
  const restore = { node: env.NODE_ENV, flag: env.AUTH_REQUIRE_2FA };
  try {
    (env as Record<string, string | undefined>).NODE_ENV = "production";
    env.AUTH_REQUIRE_2FA = "false";
    assert.equal(twoFactorRequired(), true, "production ignores the opt-out entirely");

    (env as Record<string, string | undefined>).NODE_ENV = "development";
    assert.equal(twoFactorRequired(), false, "a dev stack with no TOTP may opt out");

    delete env.AUTH_REQUIRE_2FA;
    assert.equal(twoFactorRequired(), true, "unset means on, so a typo fails closed");
    env.AUTH_REQUIRE_2FA = "FALSE";
    assert.equal(twoFactorRequired(), false, "the opt-out is case-insensitive by design");
    env.AUTH_REQUIRE_2FA = "no";
    assert.equal(twoFactorRequired(), true, "anything but 'false' means on");
  } finally {
    (env as Record<string, string | undefined>).NODE_ENV = restore.node;
    if (restore.flag === undefined) delete env.AUTH_REQUIRE_2FA;
    else env.AUTH_REQUIRE_2FA = restore.flag;
  }
});

test("only the five admin roles survive the claim reader", () => {
  const claims = decodeAccessToken(
    tokenWith({
      realm_access: {
        roles: ["patient", "doctor", "offline_access", "support", "finance", "uma_authorization"],
      },
    }),
  );
  assert.deepEqual(adminRolesFrom(claims), ["finance", "support"]);
  assert.deepEqual(adminRolesFrom(decodeAccessToken(tokenWith({}))), []);
  assert.deepEqual(
    adminRolesFrom(decodeAccessToken(tokenWith({ realm_access: { roles: ["patient"] } }))),
    [],
    "a patient token must yield no admin role, so signIn refuses the session",
  );
});

test("a malformed token decodes to null rather than throwing into the sign-in flow", () => {
  assert.equal(decodeAccessToken("not-a-jwt"), null);
  assert.equal(decodeAccessToken("a.b"), null);
  assert.equal(decodeAccessToken("a.!!!!.c"), null);
  assert.equal(decodeAccessToken(`${Buffer.from("{}").toString("base64url")}.x.y`), null);
});
