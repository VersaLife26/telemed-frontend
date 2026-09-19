import assert from "node:assert/strict";
import test from "node:test";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/consumer/env";
import { cookieHeaderWithAuth, shouldAttemptRefresh } from "@/lib/consumer/auth/refresh";
import { servedBy } from "@/lib/surface-routes";

test("refresh runs when the access cookie is gone and a refresh cookie remains", () => {
  assert.equal(shouldAttemptRefresh("/home", false, true), true);
  assert.equal(shouldAttemptRefresh("/api/proxy/users/me", false, true), true);
  assert.equal(shouldAttemptRefresh("/home", true, true), false);
  assert.equal(shouldAttemptRefresh("/home", false, false), false);
  assert.equal(shouldAttemptRefresh("/api/auth/refresh", false, true), false);
  assert.equal(shouldAttemptRefresh("/api/auth/logout", false, true), false);
});

test("cookieHeaderWithAuth replaces only the surface session cookies", () => {
  const next = cookieHeaderWithAuth("foo=1; telemed_patient_access=old; bar=2", "access2", "refresh2");
  assert.equal(next.includes("foo=1"), true);
  assert.equal(next.includes("bar=2"), true);
  assert.equal(next.includes(`${ACCESS_COOKIE}=access2`), true);
  assert.equal(next.includes(`${REFRESH_COOKIE}=refresh2`), true);
  assert.equal(next.includes("old"), false);
});

test("patient and doctor surfaces publish the refresh route", () => {
  assert.equal(servedBy("patient", "/api/auth/refresh"), true);
  assert.equal(servedBy("doctor", "/api/auth/refresh"), true);
  assert.equal(servedBy("admin", "/api/auth/refresh"), false);
});
