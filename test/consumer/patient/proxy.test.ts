import assert from "node:assert/strict";
import test from "node:test";

import { gatewayUrl, shouldForwardBody } from "@/lib/consumer/proxy";

test("gatewayUrl joins /api/v1 and encodes each segment", () => {
  assert.equal(
    gatewayUrl("http://localhost:8080", ["appointments", "a1", "payment", "intent"]),
    "http://localhost:8080/api/v1/appointments/a1/payment/intent",
  );
  assert.equal(
    gatewayUrl("http://localhost:8080/", ["vault", "a b"], "?documentType=scan"),
    "http://localhost:8080/api/v1/vault/a%20b?documentType=scan",
  );
});

test("shouldForwardBody skips GET and HEAD only", () => {
  assert.equal(shouldForwardBody("GET"), false);
  assert.equal(shouldForwardBody("HEAD"), false);
  assert.equal(shouldForwardBody("get"), false);
  assert.equal(shouldForwardBody("POST"), true);
  assert.equal(shouldForwardBody("PUT"), true);
  assert.equal(shouldForwardBody("PATCH"), true);
  assert.equal(shouldForwardBody("DELETE"), true);
});

test("isNullBodyStatus covers 204/205/304 only", async () => {
  const { isNullBodyStatus } = await import("@/lib/consumer/proxy");
  assert.equal(isNullBodyStatus(204), true);
  assert.equal(isNullBodyStatus(205), true);
  assert.equal(isNullBodyStatus(304), true);
  assert.equal(isNullBodyStatus(200), false);
  assert.equal(isNullBodyStatus(201), false);
  assert.equal(isNullBodyStatus(404), false);
});
