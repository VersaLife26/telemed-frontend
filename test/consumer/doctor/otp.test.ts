import assert from "node:assert/strict";
import test from "node:test";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/consumer/env";
import {
  missingTokensMessage,
  sendOtpBody,
  sendOtpError,
  verifyOtpBody,
  verifyOtpError,
} from "@/lib/consumer/features/otp";

test("send refuses a blank phone", () => {
  assert.equal(sendOtpError(""), "Phone is required");
  assert.equal(sendOtpError("+94761111002"), null);
});

test("send body carries phone and language only", () => {
  assert.deepEqual(sendOtpBody("+94761111002"), {
    phone: "+94761111002",
    language: "en",
  });
});

test("verify requires phone and code", () => {
  assert.equal(verifyOtpError("+94", ""), "Phone and OTP are required");
  assert.equal(verifyOtpError("+94", "123456"), null);
  assert.deepEqual(verifyOtpBody("+94", "123456"), {
    phone: "+94",
    code: "123456",
  });
});

test("missing tokens is a 502-shaped message", () => {
  assert.equal(missingTokensMessage(), "OTP verify response missing tokens");
});

test("doctor cookies do not collide with the patient app", () => {
  assert.equal(ACCESS_COOKIE, "telemed_doctor_access");
  assert.equal(REFRESH_COOKIE, "telemed_doctor_refresh");
});
