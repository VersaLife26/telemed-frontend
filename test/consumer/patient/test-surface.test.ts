import assert from "node:assert/strict";
import test from "node:test";

import { servedBy } from "@/lib/surface-routes";
import { TEST_MODE } from "@/lib/consumer/env";

// These run with the default environment, where TELEMED_TEST_MODE is unset and
// therefore on -- the same default the backend uses.
test("the test console defaults to on, matching the backend", () => {
  assert.equal(TEST_MODE, true);
});

test("the test console is published by the patient and doctor surfaces", () => {
  assert.equal(servedBy("patient", "/test"), true);
  assert.equal(servedBy("doctor", "/test"), true);
});

// The admin console requires an Auth.js session and a role claim on every
// request through adminProxy. An unauthenticated page there would be the first
// exception to that, on the one surface that also carries an IP allowlist and
// `__Host-` cookies.
test("the test console is NOT published by the admin surface", () => {
  assert.equal(servedBy("admin", "/test"), false);
});

test("paths below /test are served too", () => {
  assert.equal(servedBy("patient", "/test/anything"), true);
});

// The prefix must match on a whole segment, so a path that merely starts with
// the same letters is not quietly admitted.
test("a path that only shares the prefix is not served", () => {
  assert.equal(servedBy("patient", "/testing"), false);
  assert.equal(servedBy("patient", "/testosterone"), false);
});
