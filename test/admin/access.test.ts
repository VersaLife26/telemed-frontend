import assert from "node:assert/strict";
import test from "node:test";

import { ACCESS_JWT_COOKIE, ACCESS_JWT_HEADER, accessJwtFrom } from "@/lib/admin/auth/access-token";
import { decodeAccessClaims, millisUntilExpiry } from "@/lib/admin/auth/claims";

/**
 * Cloudflare Access replaced Keycloak as the admin console's identity
 * provider. This file replaced the Auth.js session test, whose subjects --
 * cookie flags, token refresh, and the `amr`/`acr` 2FA gate -- no longer
 * exist here: there is no session cookie this application owns, no refresh,
 * and whether a second factor was required is a property of the Access policy
 * that cannot be re-checked from inside the app.
 */

function withHeaders(init: Record<string, string>): { headers: Headers } {
  return { headers: new Headers(init) };
}

// ---------------------------------------------------------------------------
// Reading the token off a request
// ---------------------------------------------------------------------------

test("the Access header is the primary source", () => {
  const source = withHeaders({ [ACCESS_JWT_HEADER]: "a.b.c" });
  assert.equal(accessJwtFrom(source), "a.b.c");
});

test("the cookie is a fallback when the header is absent", () => {
  const source = withHeaders({ cookie: `foo=1; ${ACCESS_JWT_COOKIE}=x.y.z; bar=2` });
  assert.equal(accessJwtFrom(source), "x.y.z");
});

test("the header wins over the cookie", () => {
  // A browser cannot set the header cross-site, so preferring it keeps the
  // obvious CSRF shape out of the way when both are present.
  const source = withHeaders({
    [ACCESS_JWT_HEADER]: "header.token.here",
    cookie: `${ACCESS_JWT_COOKIE}=cookie.token.here`,
  });
  assert.equal(accessJwtFrom(source), "header.token.here");
});

test("no Access credential at all reads as null, not as an empty token", () => {
  assert.equal(accessJwtFrom(withHeaders({})), null);
  assert.equal(accessJwtFrom(withHeaders({ [ACCESS_JWT_HEADER]: "   " })), null);
  assert.equal(accessJwtFrom(withHeaders({ cookie: `${ACCESS_JWT_COOKIE}=` })), null);
  assert.equal(accessJwtFrom(withHeaders({ cookie: "unrelated=1" })), null);
});

test("a cookie value containing = survives being split", () => {
  const source = withHeaders({ cookie: `${ACCESS_JWT_COOKIE}=a.b.c==` });
  assert.equal(accessJwtFrom(source), "a.b.c==");
});

// ---------------------------------------------------------------------------
// Decoding — read-only, never verification
// ---------------------------------------------------------------------------

function jwtWith(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "RS256" })}.${encode(payload)}.signature-not-checked`;
}

test("the email claim is what admin_users is matched on", () => {
  const claims = decodeAccessClaims(jwtWith({ email: "ops@clinic.lk", exp: 123 }));
  assert.equal(claims?.email, "ops@clinic.lk");
  assert.equal(claims?.exp, 123);
});

test("a malformed token decodes to null rather than throwing", () => {
  // This runs on every request. Throwing here would turn a stray cookie into
  // a 500 on every page of the console.
  assert.equal(decodeAccessClaims("not-a-jwt"), null);
  assert.equal(decodeAccessClaims("only.two"), null);
  assert.equal(decodeAccessClaims("a.!!!not-base64!!!.c"), null);
  assert.equal(decodeAccessClaims(""), null);
});

test("a token carrying no roles is normal, not an error", () => {
  // The whole point of the split: Access says who you are, admin_users says
  // what you may do. A token with an identity and nothing else is exactly
  // what Access issues.
  const claims = decodeAccessClaims(jwtWith({ email: "someone@clinic.lk" }));
  assert.ok(claims);
  assert.equal((claims as Record<string, unknown>).realm_access, undefined);
});

test("expiry is reported in milliseconds from now, or null when absent", () => {
  const now = 1_000_000;
  assert.equal(millisUntilExpiry(decodeAccessClaims(jwtWith({ exp: 1_060 })), now), 60_000);
  assert.equal(millisUntilExpiry(decodeAccessClaims(jwtWith({ email: "a@b.c" })), now), null);
  assert.equal(millisUntilExpiry(null, now), null);
});
