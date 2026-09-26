import assert from "node:assert/strict";
import test from "node:test";

import { servedBy } from "@/lib/surface-routes";
import { TEST_MODE, TEST_SECRET } from "@/lib/consumer/env";
import { otpCodeOf } from "@/lib/test/api";

// These run with the default environment, where NEXT_PUBLIC_TELEMED_TEST_MODE
// and TEST_SECRET are unset.
test("the test console page defaults to on", () => {
  assert.equal(TEST_MODE, true);
});

test("without TEST_SECRET the proxy sends no test secret", () => {
  assert.equal(TEST_SECRET, "");
});

test("the OTP code is read out of a captured English message", () => {
  assert.equal(otpCodeOf("Your VersaLife code is 482913. Valid for 5 minutes."), "482913");
  assert.equal(otpCodeOf("Your appointment on 2026-09-26 is confirmed."), null);
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
