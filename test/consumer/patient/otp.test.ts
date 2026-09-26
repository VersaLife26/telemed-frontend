import assert from "node:assert/strict";
import test from "node:test";

import {
  missingTokensMessage,
  sendOtpBody,
  sendOtpError,
  verifyOtpBody,
  verifyOtpError,
} from "@/lib/consumer/features/otp";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/consumer/env";

test("send refuses a blank phone", () => {
  assert.equal(sendOtpError(""), "Phone is required");
  assert.equal(sendOtpError("  "), "Phone is required");
  assert.equal(sendOtpError("+94761111001"), null);
});

test("send body trims the phone and has no purpose", () => {
  assert.deepEqual(sendOtpBody(" +94761111001 "), {
    phone: "+94761111001",
    language: "en",
  });
});

test("verify requires both phone and code", () => {
  assert.equal(verifyOtpError("+94", ""), "Phone and OTP are required");
  assert.equal(verifyOtpError("", "123456"), "Phone and OTP are required");
  assert.equal(verifyOtpError("+94", "123456"), null);
});

test("verify body sends the trimmed code field", () => {
  assert.deepEqual(verifyOtpBody(" +94 ", " 99 "), {
    phone: "+94",
    code: "99",
  });
});

test("missing tokens is a 502-shaped message", () => {
  assert.equal(missingTokensMessage(), "OTP verify response missing tokens");
});

test("patient cookies do not collide with the doctor app", () => {
  assert.equal(ACCESS_COOKIE, "telemed_patient_access");
  assert.equal(REFRESH_COOKIE, "telemed_patient_refresh");
});
